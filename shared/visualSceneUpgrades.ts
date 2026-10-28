import type { Lesson } from "./curriculum.ts";
import type { Scene, SceneStep } from "./scenes.ts";
const codeUpgrades: Record<string, { code: string; lines: number[] }> = {
  "c-12": {
    code: '#include <stdio.h>\nint add_one(int value) { return value + 1; }\nint main(void) {\n    int n = 5;\n    int result = add_one(n);\n    n = result;\n    printf("%d", n);\n    return 0;\n}',
    lines: [4, 5, 6, 7],
  },
  "c-15": {
    code: '#include <stdio.h>\nvoid increment(int *p) {\n    (*p)++;\n}\nint main(void) {\n    int n = 5;\n    increment(&n);\n    printf("%d", n);\n    return 0;\n}',
    lines: [6, 7, 3, 8],
  },
  "cpp-16": {
    code: "#include <iostream>\nclass Account {\n    int balance = 10;\npublic:\n    void deposit(int amount) { if (amount > 0) balance += amount; }\n    int get() const { return balance; }\n};\nint main() {\n    Account account;\n    account.deposit(-3);\n    account.deposit(5);\n    std::cout << account.get();\n}",
    lines: [9, 10, 11, 12],
  },
  "cpp-17": {
    code: '#include <iostream>\nstruct Position { int x, y; };\nstruct Player {\n    Position position{0, 0};\n    void move(int dx) { position.x += dx; }\n};\nint main() {\n    Player player;\n    player.move(3);\n    std::cout << player.position.x << " " << player.position.y;\n}',
    lines: [8, 9, 10],
  },
  "cpp-18": {
    code: '#include <iostream>\n#include <vector>\nstruct Counter { int value = 0; void add(int n) { value += n; } };\nint main() {\n    std::vector<Counter> counters(2);\n    counters[0].add(4);\n    std::cout << counters[0].value << " " << counters[1].value;\n}',
    lines: [5, 6, 7],
  },
  "python-16": {
    code: "class Counter:\n    def __init__(self):\n        self.value = 0\n    def add(self):\n        self.value += 1\ncounter = Counter()\ncounter.value = 5\ncounter.add()\nprint(counter.value)",
    lines: [6, 7, 8, 9],
  },
  "python-18": {
    code: "class Counter:\n    def __init__(self):\n        self.value = 0\n    def add(self, amount):\n        self.value += amount\na = Counter()\nb = Counter()\na.add(4)\nprint(a.value, b.value)",
    lines: [6, 7, 8, 9],
  },
};
const step = (
  line: number,
  note: string,
  values: SceneStep["values"],
  extra: Partial<SceneStep> = {},
): SceneStep => ({
  id: "",
  line,
  note,
  values,
  output: "",
  phase: "刚执行",
  ...extra,
});
export function upgradeVisualScene(lesson: Lesson, original: Scene): Scene {
  let code = codeUpgrades[lesson.id]?.code,
    steps = code
      ? original.steps.map((s, i) => ({
          ...s,
          line: codeUpgrades[lesson.id].lines[i],
        }))
      : undefined;
  if (lesson.id === "c-18") {
    code =
      '#include <stdio.h>\nstruct Student { int score; };\nint main(void) {\n    struct Student students[3] = {{60}, {70}, {80}};\n    int total = 0;\n    for (int i = 0; i < 3; i++) {\n        total += students[i].score;\n    }\n    printf("%d", total);\n    return 0;\n}';
    const scores = [60, 70, 80];
    steps = [
      step(4, "三个结构体对象分别拥有自己的score。", {}, { items: scores }),
      step(5, "累加器初始化为0。", { total: 0 }, { items: scores }),
    ];
    let total = 0;
    scores.forEach((score, i) => {
      steps!.push(
        step(
          6,
          `定位students[${i}]，准备读取它的score。`,
          { i, total },
          { items: scores, active: i },
        ),
      );
      const previous = total;
      total += score;
      steps!.push(
        step(
          7,
          `读取score=${score}：${previous}+${score}=${total}。`,
          { i, total, score },
          { items: scores, active: i },
        ),
      );
    });
    steps.push(
      step(
        9,
        "遍历结束后输出三个对象的总分。",
        { total },
        { items: scores, output: "210" },
      ),
    );
  }
  if (lesson.id === "cpp-10") {
    code =
      "#include <iostream>\n#include <vector>\nint main() {\n    std::vector<int> values = {2, 4};\n    values.push_back(6);\n    int total = 0;\n    for (int value : values) {\n        total += value;\n    }\n    std::cout << total;\n}";
    const items = [2, 4, 6];
    steps = [
      step(4, "vector当前有两个逻辑元素。", { size: 2 }, { items: [2, 4] }),
      step(
        5,
        "把6追加到逻辑末尾，size变为3。",
        { size: 3 },
        { items, active: 2 },
      ),
      step(6, "total从0开始。", { total: 0 }, { items }),
    ];
    let total = 0;
    items.forEach((value, i) => {
      steps!.push(
        step(
          7,
          `范围for取出第${i + 1}项${value}。`,
          { value, total },
          { items, active: i },
        ),
      );
      const previous = total;
      total += value;
      steps!.push(
        step(
          8,
          `${previous}+${value}=${total}。`,
          { value, total },
          { items, active: i },
        ),
      );
    });
    steps.push(
      step(
        10,
        "追加的6也被遍历，最终输出12。",
        { total },
        { items, output: "12" },
      ),
    );
  }
  if (!code || !steps) return original;
  return {
    ...original,
    id: `scene-v2:${lesson.id}:authored`,
    version: "scene-v2",
    code,
    steps: steps.map((s, i) => ({ ...s, id: `step-${i}` })),
  };
}
