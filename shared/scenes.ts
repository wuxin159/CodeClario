import type { Lesson } from "./curriculum.ts";
import { extensionFor } from "./courseExtensions.ts";
import { upgradeVisualScene } from "./visualSceneUpgrades.ts";

export type SceneOptions = { fixed: boolean; value: number; text: string };
export type SceneStep = {
  id: string;
  line: number;
  phase: string;
  note: string;
  values: Record<string, string | number>;
  output: string;
  items?: (number | string)[];
  active?: number;
  branch?: boolean;
  frame?: boolean;
  returned?: number;
  change?: string;
  links?: {
    from: string;
    to: string;
    label: string;
    fields: Record<string, string | number>;
  }[];
};
export type Scene = {
  id: string;
  version: string;
  code: string;
  steps: SceneStep[];
  title: string;
};
export const defaultSceneOptions = (lesson: Lesson): SceneOptions => ({
  fixed: false,
  value:
    lesson.index === 2
      ? 18
      : lesson.index === 4
        ? 6
        : lesson.index === 5
          ? 5
          : lesson.index === 1
            ? 42
            : 5,
  text: "Hello!",
});

// These are authored, deterministic teaching models, never traces of user code.
export function buildScene(lesson: Lesson, raw: SceneOptions): Scene {
  const extended = extensionFor(lesson.id);
  if (extended)
    return upgradeVisualScene(lesson, {
      ...extended.demo,
      id: `scene-v1:${lesson.id}:authored`,
      version: "scene-v1",
    });
  const o = {
    ...raw,
    value: Number.isFinite(raw.value)
      ? Math.max(-9, Math.min(99, Math.trunc(raw.value)))
      : 5,
    text: raw.text.slice(0, 28).replace(/[\x00-\x1f\x7f]/g, " "),
  };
  const py = lesson.language === "python",
    cpp = lesson.language === "cpp";
  const steps: SceneStep[] = [];
  const push = (
    line: number,
    phase: string,
    note: string,
    values: SceneStep["values"] = {},
    extra: Partial<SceneStep> = {},
  ) =>
    steps.push({
      id: `step-${steps.length}`,
      line,
      phase,
      note,
      values,
      output: "",
      ...extra,
    });
  const print = (value: string) =>
    py
      ? `print(${value})`
      : cpp
        ? `std::cout << ${value} << std::endl;`
        : `printf("%d\\n", ${value});`;
  let code = "",
    title = "";
  const literal = JSON.stringify(o.text);
  if (lesson.index === 0) {
    title = "输出按顺序追加";
    code = py
      ? `print(${literal})\nprint("world")`
      : cpp
        ? `std::cout << ${literal} << std::endl;\nstd::cout << "world" << std::endl;`
        : `printf("%s\\n", ${literal});\nprintf("world\\n");`;
    push(1, "即将执行", "先观察第一条输出语句。", {}, { output: "" });
    push(
      1,
      "刚执行",
      "第一条语句追加文字与换行。",
      {},
      { output: o.text + "\n" },
    );
    push(
      2,
      "即将执行",
      "第二条语句不会覆盖之前的输出。",
      {},
      { output: o.text + "\n" },
    );
    push(
      2,
      "刚执行",
      "world追加到下一行。",
      {},
      { output: o.text + "\nworld\n" },
    );
  } else if (lesson.index === 1) {
    title = py ? "名字绑定到新的值" : "计算右值，再更新变量";
    code = `${py ? "" : "int "}answer = 0${py ? "" : ";"}\nanswer = ${o.value}${py ? "" : ";"}\n${print("answer")}`;
    push(1, "即将执行", py ? "answer尚未绑定。" : "本例即将初始化整型变量。", {
      answer: "尚未初始化",
    });
    push(
      1,
      "刚执行",
      "answer现在为0。",
      { answer: 0 },
      { change: "未初始化 → 0" },
    );
    push(2, "概念拆解", `先得到右侧的值${o.value}。`, {
      answer: 0,
      右值: o.value,
    });
    push(
      2,
      "刚执行",
      py ? `名字answer现在绑定到${o.value}。` : `把${o.value}写入answer。`,
      { answer: o.value },
      { change: `0 → ${o.value}` },
    );
    push(
      3,
      "刚执行",
      "输出读取更新后的当前值。",
      { answer: o.value },
      { output: String(o.value) + "\n" },
    );
  } else if (lesson.index === 2) {
    title = "条件决定实际选路";
    const condition = o.fixed ? "age >= 18" : "age > 20";
    const truth = o.fixed ? o.value >= 18 : o.value > 20;
    code = py
      ? `age = int(input())\nif ${condition}:\n    print("adult")\nelse:\n    print("minor")`
      : `${cpp ? "int age; std::cin >> age;" : 'int age; scanf("%d", &age);'}\nif (${condition}) {\n    ${cpp ? 'std::cout << "adult";' : 'printf("adult");'}\n} else {\n    ${cpp ? 'std::cout << "minor";' : 'printf("minor");'}\n}`;
    push(1, "刚执行", `课程示例读取输入${o.value}。`, { age: o.value });
    push(
      2,
      "概念拆解",
      `${condition}得到${truth ? "真" : "假"}。`,
      { age: o.value, 条件: truth ? "true" : "false" },
      { branch: truth },
    );
    push(
      truth ? 3 : 5,
      "刚执行",
      `只执行${truth ? "if" : "else"}分支。`,
      { age: o.value, 条件: truth ? "true" : "false" },
      { branch: truth, output: truth ? "adult" : "minor" },
    );
  } else if (lesson.index === 3) {
    title = py ? "从range逐项取值" : "判断、执行、更新";
    const n = Math.max(1, Math.min(8, o.value));
    const end = o.fixed ? n : n - 1;
    code = py
      ? `total = 0\nfor i in range(1, ${o.fixed ? n + 1 : n}):\n    total += i\nprint(total)`
      : `int total = 0;\nfor (int i = 1; i ${o.fixed ? "<=" : "<"} ${n}; i++) {\n    total += i;\n}\n${print("total")}`;
    let total = 0;
    push(1, "刚执行", "累加变量从0开始。", { total });
    for (let i = 1; i <= end; i++) {
      push(
        2,
        py ? "取下一个值" : "条件成立",
        py
          ? `range给出下一项${i}。`
          : `${i} ${o.fixed ? "<=" : "<"} ${n}成立。`,
        { i, total },
      );
      const old = total;
      total += i;
      push(
        3,
        "刚执行",
        `本轮把${i}加入：${old}+${i}=${total}。`,
        { i, total },
        { change: `${old} → ${total}` },
      );
    }
    push(
      2,
      "循环结束",
      py
        ? "迭代范围已用尽，不再进入循环体。"
        : `下一次判断${end + 1} ${o.fixed ? "<=" : "<"} ${n}为假。`,
      { total, ...(py ? (end >= 1 ? { i: end } : {}) : { i: end + 1 }) },
    );
    push(
      py ? 4 : 5,
      "刚执行",
      py && end >= 1
        ? "循环结束后i仍保留最后一次取值；输出总和。"
        : "循环结束后输出总和。",
      { total, ...(py && end >= 1 ? { i: end } : {}) },
      { output: String(total) + "\n" },
    );
  } else if (lesson.index === 4) {
    title = py ? "切片范围与逐项遍历" : "下标决定访问的元素";
    const items = [2, 4, Math.max(-9, Math.min(9, o.value))];
    // Default third element remains 6, matching the current lesson.
    code = py
      ? `numbers = [${items.join(", ")}]\ntotal = 0\nfor number in ${o.fixed ? "numbers" : "numbers[:2]"}:\n    total += number\nprint(total)`
      : `int numbers[] = {${items.join(", ")}};\nint total = 0;\nfor (int i = 0; i < ${o.fixed ? 3 : 2}; i++) {\n    total += numbers[i];\n}\n${print("total")}`;
    let total = 0;
    push(1, "刚执行", "创建包含三个元素的序列。", {}, { items });
    push(2, "刚执行", "total从0开始。", { total }, { items });
    if (py && !o.fixed)
      push(
        3,
        "概念拆解",
        "numbers[:2]选出前两项；第三项不在切片中。",
        { total, 迭代范围: "[2, 4]" },
        { items },
      );
    items.slice(0, o.fixed ? 3 : 2).forEach((item, i) => {
      push(
        3,
        "当前访问",
        py
          ? `本轮取到元素${item}；这里没有名为i的变量。`
          : `numbers[${i}]的值为${item}。`,
        { ...(py ? { number: item } : { i }), total },
        { items, active: i },
      );
      const old = total;
      total += item;
      push(
        4,
        "刚执行",
        `${old}+${item}=${total}。`,
        { ...(py ? { number: item } : { i }), total },
        { items, active: i, change: `${old} → ${total}` },
      );
    });
    push(
      3,
      "遍历结束",
      o.fixed
        ? "三个元素都已处理。"
        : `只处理了前两项，第三项${items[2]}被遗漏。`,
      { total },
      { items },
    );
    push(
      py ? 5 : 6,
      "刚执行",
      "输出遍历后的总和。",
      { total },
      { items, output: String(total) + "\n" },
    );
  } else {
    title = "参数进入，返回值离开";
    const value = o.value,
      result = o.fixed ? value * value : value;
    code = py
      ? `def square(n):\n    return ${o.fixed ? "n * n" : "n"}\n\nprint(square(${value}))`
      : `int square(int n) {\n    return ${o.fixed ? "n * n" : "n"};\n}\n${cpp ? `std::cout << square(${value});` : `printf("%d", square(${value}));`}`;
    push(4, "即将调用", `调用square(${value})，实参是${value}。`, {
      实参: value,
    });
    push(
      1,
      "进入函数",
      `创建本次square调用的局部帧，n=${value}。`,
      { n: value },
      { frame: true },
    );
    push(
      2,
      "返回",
      `${o.fixed ? `${value}*${value}` : "n"}得到${result}，交还调用处。`,
      { n: value },
      { frame: true, returned: result },
    );
    push(
      4,
      "回到调用处",
      "本次函数调用结束，调用表达式取得返回值。",
      { 返回值: result },
      { returned: result },
    );
    push(
      4,
      "刚执行",
      "调用处输出返回值；return和输出是两个动作。",
      { 返回值: result },
      { returned: result, output: String(result) },
    );
  }
  return {
    id: `scene-v1:${lesson.id}:${JSON.stringify(o)}`,
    version: "scene-v1",
    code,
    steps,
    title,
  };
}
