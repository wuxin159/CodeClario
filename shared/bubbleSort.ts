import type { Language } from "./curriculum.ts";
import type { Scene, SceneStep } from "./scenes.ts";

export type BubbleItem = { key: number; value: number };
export type BubbleState = {
  items: BubbleItem[];
  phase: "ready" | "pass" | "compare" | "swap" | "keep" | "settled" | "done" | "stopped";
  passIndex: number;
  pair: number | null;
  sortedFrom: number;
  comparisons: number;
  swaps: number;
  comparison?: boolean;
  temporary?: number;
};
export const BUBBLE_INPUT = [5, 1, 4, 2, 3];
export const BUBBLE_DATASETS = [
  { label: "混合顺序", values: BUBBLE_INPUT },
  { label: "完全倒序", values: [5, 4, 3, 2, 1] },
  { label: "含重复值", values: [3, 1, 3, 2, 1] },
] as const;

function loopLines(language: Language, onePass: boolean) {
  const limit = onePass ? "1" : "n - 1";
  return language === "python" ? [
    `for pass_index in range(${limit}):`,
    "    for j in range(n - 1 - pass_index):",
    "        if numbers[j] > numbers[j + 1]:",
    "            temp = numbers[j]",
    "            numbers[j] = numbers[j + 1]",
    "            numbers[j + 1] = temp",
  ] : [
    `for (int pass_index = 0; pass_index < ${limit}; pass_index++) {`,
    "    for (int j = 0; j < n - 1 - pass_index; j++) {",
    "        if (numbers[j] > numbers[j + 1]) {",
    "            int temp = numbers[j];",
    "            numbers[j] = numbers[j + 1];",
    "            numbers[j + 1] = temp;",
    "        }",
    "    }",
    "}",
  ];
}
function outputLines(language: Language) {
  return language === "python"
    ? ["for number in numbers:", "    print(number)"]
    : [language === "c"
      ? 'for (int k = 0; k < n; k++) printf("%d\\n", numbers[k]);'
      : "for (int k = 0; k < n; k++) std::cout << numbers[k] << '\\n';"];
}

/** 示例、练习与复测共用循环生成器，避免三种语言的边界写法悄悄分叉。 */
export function bubbleCode(language: Language, values: readonly number[], onePass = false) {
  const declarations = language === "python"
    ? [`numbers = [${values.join(", ")}]`, `n = ${values.length}`]
    : [`int numbers[] = {${values.join(", ")}};`, `int n = ${values.length};`];
  const lines = [...declarations, ...loopLines(language, onePass), ...outputLines(language)];
  // 一轮结束对应内层循环检查结束；不能指向可能根本没有执行的交换赋值行。
  return { code: lines.join("\n"), lines: { initial: 2, pass: 3, compare: 5, swapStart: 6, swapEnd: 8, passEnd: 4, output: lines.length } };
}

export function bubbleProgram(language: Language, options: { onePass?: boolean; values?: readonly number[] } = {}) {
  let body: string;
  if (options.values) body = bubbleCode(language, options.values, options.onePass).code;
  else {
    // 本课固定读5项，避免在刚学数组时引入变长数组、容器扩容或列表推导式。
    const input = language === "python"
      ? ["# 顺序读入五项，让本课的执行观察集中在排序的两层循环。", "numbers = [int(input()), int(input()), int(input()), int(input()), int(input())]", "n = 5"]
      : ["int numbers[5];", "int n = 5;", "for (int k = 0; k < n; k++) {", language === "c" ? '    scanf("%d", &numbers[k]);' : "    std::cin >> numbers[k];", "}"];
    body = [...input, ...loopLines(language, !!options.onePass), ...outputLines(language)].join("\n");
  }
  if (language === "python") return body + "\n";
  return `${language === "c" ? "#include <stdio.h>" : "#include <iostream>"}\n\nint main(${language === "c" ? "void" : ""}) {\n${body.split("\n").map(line => "    " + line).join("\n")}\n    return 0;\n}\n`;
}

/** 这是审校课程模型，不是任意学生源码的执行轨迹。每个状态保存独立快照。 */
export function buildBubbleScene(language: Language, values: readonly number[] = BUBBLE_INPUT, onePass = false): Scene {
  if (values.length < 2 || values.length > 8 || values.some(value => !Number.isInteger(value) || Math.abs(value) > 99)) throw new Error("冒泡示例需要2到8个、绝对值不超过99的整数。");
  const source = bubbleCode(language, values, onePass);
  const items = values.map((value, key) => ({ key, value }));
  const n = items.length, steps: SceneStep[] = [];
  let comparisons = 0, swaps = 0, sortedFrom = n;
  const push = (phase: BubbleState["phase"], line: number, note: string, passIndex = -1, pair: number | null = null, extras: Partial<BubbleState> = {}) => {
    const bubble: BubbleState = { items: items.map(item => ({ ...item })), phase, passIndex, pair, sortedFrom, comparisons, swaps, ...extras };
    const phaseName = { ready: "准备开始", pass: "开始一轮", compare: "比较相邻项", swap: "交换位置", keep: "保持顺序", settled: "本轮完成", done: "排序完成", stopped: "一轮结束" }[phase];
    steps.push({ id: `bubble-step-${steps.length}`, line, phase: phaseName, note,
      values: { n, pass_index: passIndex, j: pair ?? "—", comparisons, swaps, sortedFrom, ...(extras.temporary === undefined ? {} : { temp: extras.temporary }) },
      items: items.map(item => item.value), active: pair ?? undefined, bubble,
      output: phase === "done" || phase === "stopped" ? items.map(item => item.value).join("\n") + "\n" : "",
    });
  };
  push("ready", source.lines.initial, `数组有${n}项。每次只比较相邻两项，目标是从小到大排列。`);
  const passes = onePass ? 1 : n - 1;
  for (let passIndex = 0; passIndex < passes; passIndex++) {
    push("pass", source.lines.pass, `第${passIndex + 1}轮开始：j从0重新出发，只处理尚未就位的前${n - passIndex}项。`, passIndex);
    for (let j = 0; j < n - 1 - passIndex; j++) {
      const left = items[j].value, right = items[j + 1].value, greater = left > right;
      comparisons++;
      push("compare", source.lines.compare, `比较 numbers[${j}]=${left} 和 numbers[${j + 1}]=${right}：${left} > ${right} ${greater ? "成立，准备交换" : "不成立，保持顺序"}。`, passIndex, j, { comparison: greater });
      if (greater) {
        [items[j], items[j + 1]] = [items[j + 1], items[j]];
        swaps++;
        // 一次交换对应temp暂存、左侧写入、右侧写回三条赋值；几何可连续，数值不插值。
        push("swap", source.lines.swapEnd, `先用temp保存${left}，把${right}写到左边，再把temp写到右边。三条赋值合并演示为一次交换。`, passIndex, j, { temporary: left, comparison: true });
      } else push("keep", source.lines.compare, `这两项已经符合升序，继续向右比较。相等时不交换，保留它们的原先顺序。`, passIndex, j, { comparison: false });
    }
    sortedFrom = n - 1 - passIndex;
    push("settled", source.lines.passEnd, `第${passIndex + 1}轮结束：本轮最大值${items[sortedFrom].value}已到下标${sortedFrom}。右侧${n - sortedFrom}项已就位，下一轮少比较一对。`, passIndex);
  }
  if (!onePass) sortedFrom = 0;
  push(onePass ? "stopped" : "done", source.lines.output, onePass
    ? (n === 2 ? "本例只有两项，一轮就完成了所需比较。" : "只做一轮通常只能保证一个最大值就位。检查左边的顺序；完整算法会继续处理剩下的部分。")
    : `全部排序完成。共比较${comparisons}次、交换${swaps}次；原来的元素没有增加或丢失。`, passes - 1);
  return { id: `bubble-v1:${language}:${values.join(",")}:${onePass ? "one-pass" : "complete"}`, version: "bubble-v1", title: "比较、交换，再确认一轮的结果", code: source.code, steps };
}
