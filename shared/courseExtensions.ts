import type { Language, Lesson } from "./curriculum.ts";
import type { Question } from "./teaching.ts";
import type { SceneStep } from "./scenes.ts";

type Quiz = Omit<Question, "id">;
type DemoStep = [
  number,
  string,
  Record<string, string | number>,
  Partial<SceneStep>?,
];
type Demo = { code: string; steps: SceneStep[]; title: string };
type Definition = {
  language: Language;
  number: number;
  order: number;
  title: string;
  chapter: string;
  concepts: string[];
  reading: [string, string, string, string];
  task: string;
  starter: string;
  solution: string;
  stdin: string;
  tests: { input: string; expected: string }[];
  quizzes: [Quiz, Quiz];
  demo: Demo;
};
const q = (
  prompt: string,
  options: string[],
  correct: number,
  explanation: string,
): Quiz => ({ prompt, options, correct, explanation });
const tests = (...pairs: [string, string][]) =>
  pairs.map(([input, expected]) => ({ input, expected }));
const demo = (title: string, code: string, ...steps: DemoStep[]): Demo => ({
  title,
  code,
  steps: steps.map(([line, note, values, extra], i) => ({
    id: `step-${i}`,
    line,
    phase:
      i === 0 ? "建立状态" : i === steps.length - 1 ? "观察结果" : "刚执行",
    note,
    values,
    output: "",
    ...extra,
  })),
});
const program = (language: Language, body: string, declarations = "") =>
  language === "python"
    ? `${declarations}${body}\n`
    : `${language === "c" ? "#include <stdio.h>\n#include <string.h>" : "#include <iostream>\n#include <string>\n#include <vector>"}\n${declarations}\nint main(${language === "c" ? "void" : ""}) {\n${body
        .split("\n")
        .map((l) => "    " + l)
        .join("\n")}\n    return 0;\n}\n`;
const read = (language: Language, name = "n") =>
  language === "python"
    ? `${name} = int(input())`
    : language === "c"
      ? `int ${name};\nscanf("%d", &${name});`
      : `int ${name};\nstd::cin >> ${name};`;
const print = (language: Language, expression: string) =>
  language === "python"
    ? `print(${expression})`
    : language === "c"
      ? `printf("%d\\n", ${expression});`
      : `std::cout << ${expression} << '\\n';`;
const definitions: Definition[] = [];

// Shared fundamentals have language-specific executable examples, not translated syntax.
for (const language of ["c", "cpp", "python"] as const) {
  const py = language === "python";
  definitions.push({
    language,
    number: 7,
    order: 30,
    title: "算术运算与表达式",
    chapter: "数据与表达式",
    concepts: ["整数除法", "余数", "优先级"],
    reading: [
      "表达式先计算出值，再交给赋值或输出。乘除与取余优先于加减；括号可以明确改变顺序。",
      py
        ? "Python 的 / 得到浮点结果，// 是向下取整除法。本课只输入非负整数，把秒数拆成整分钟与剩余秒数。"
        : "两个整数相除会丢弃小数部分。本课只处理非负秒数，因此 n / 60 是整分钟，n % 60 是剩余秒数。",
      "余数不是商。例如 125 秒等于 2 分钟余 5 秒。输入 60 时，剩余秒数应为 0。",
      "读取非负整数秒数，先输出整分钟，再在下一行输出剩余秒数。不要把示例结果写死。",
    ],
    task: "读入非负整数秒数 n，输出 n 中的整分钟数和剩余秒数，分别占一行。",
    starter: program(
      language,
      `${read(language)}\n${print(language, py ? "n // 60" : "n / 60")}\n${print(language, py ? "n // 60" : "n / 60")}`,
    ),
    solution: program(
      language,
      `${read(language)}\n${print(language, py ? "n // 60" : "n / 60")}\n${print(language, "n % 60")}`,
    ),
    stdin: "125",
    tests: tests(
      ["125", "2\n5"],
      ["60", "1\n0"],
      ["0", "0\n0"],
      ["59", "0\n59"],
    ),
    quizzes: [
      q(
        "125 秒中有几个完整的 60 秒？",
        ["2", "5", "65"],
        0,
        "125 中能放下两个 60，余下 5。",
      ),
      q(
        "把 180 秒拆成分钟与余秒，输出是什么？",
        ["3 和 3", "3 和 0", "0 和 3"],
        1,
        "180 = 3 × 60 + 0。",
      ),
    ],
    demo: demo(
      "商和余数分别回答两个问题",
      `${py ? "n = 125" : "int n = 125;"}\n${print(language, py ? "n // 60" : "n / 60")}\n${print(language, "n % 60")}`,
      [1, "保存总秒数。", { n: 125 }],
      [
        2,
        "两个完整的 60 秒，先输出商。",
        { n: 125, 整分钟: 2 },
        { output: "2\n" },
      ],
      [
        3,
        "剩余 5 秒，追加余数。",
        { n: 125, 整分钟: 2, 余秒: 5 },
        { output: "2\n5\n" },
      ],
    ),
  });
  const loop = py
    ? "total = 0\ni = 1\nwhile i <= n:\n    total += i\n    i += 1\nprint(total)"
    : `int total = 0;\nint i = 1;\nwhile (i <= n) {\n    total += i;\n    i++;\n}\n${print(language, "total")}`;
  definitions.push({
    language,
    number: 8,
    order: 60,
    title: "while 循环与终止条件",
    chapter: "重复与累加",
    concepts: ["while", "循环条件", "状态更新"],
    reading: [
      "while 在每轮开始前检查条件。条件为假时，循环体一次也不执行；它适合循环次数由数据决定的场景。",
      "求 1 到 n 的和，需要 total 保存累加结果，i 保存当前数字。每轮先累加，再把 i 增加 1。",
      "若忘记更新 i，条件可能永远为真；若写 i < n，则会漏掉 n。本课 n=0 时总和应为 0。",
      "读入 0 到 20 的整数 n，使用 while 计算 1 到 n 的和，包括 n。观察条件失败后程序如何继续。",
    ],
    task: "用 while 求 1 到 n 的和（包含 n）；输入范围 0–20。修正循环条件，使 n=0 也正确输出 0。",
    starter: program(
      language,
      `${read(language)}\n${loop.replace("i <= n", "i < n")}`,
    ),
    solution: program(language, `${read(language)}\n${loop}`),
    stdin: "3",
    tests: tests(["3", "6"], ["0", "0"], ["1", "1"], ["5", "15"]),
    quizzes: [
      q(
        "i=1，n=0，条件 i<=n 为假，循环体执行几次？",
        ["0 次", "1 次", "无限次"],
        0,
        "while 先检查条件，因此不会进入循环。",
      ),
      q(
        "累加到 3 后 i 更新成 4，下一步发生什么？",
        ["再加一次 4", "条件失败，输出 6", "重新把 i 设为 1"],
        1,
        "4<=3 为假，离开循环，total 保留 6。",
      ),
    ],
    demo: demo(
      "每轮都要推进状态",
      py
        ? "total = 0; i = 1\nwhile i <= 3:\n    total += i\n    i += 1\nprint(total)"
        : `int total = 0, i = 1;\nwhile (i <= 3) {\n    total += i;\n    i++;\n}\n${print(language, "total")}`,
      [1, "累加器从 0 开始，当前数字是 1。", { total: 0, i: 1 }],
      [3, "第一轮把 1 加入。", { total: 1, i: 1 }],
      [4, "推进到下一项 2。", { total: 1, i: 2 }],
      [3, "第二轮加入 2。", { total: 3, i: 2 }],
      [4, "推进到 3。", { total: 3, i: 3 }],
      [3, "第三轮加入 3。", { total: 6, i: 3 }],
      [4, "i 更新到 4；下次判断为假。", { total: 6, i: 4 }],
      [
        py ? 5 : 6,
        "离开循环，输出累加结果。",
        { total: 6, i: 4 },
        { output: "6\n" },
      ],
    ),
  });
}

// C: text, aggregate data and the pointer model.
definitions.push(
  {
    language: "c",
    number: 9,
    order: 80,
    title: "字符与字符编码",
    chapter: "文本与数组",
    concepts: ["char", "字符字面量", "字符比较"],
    reading: [
      "char 可以保存一个字符，字符字面量使用单引号，例如 'A'；\"A\" 是字符串，不是同一种类型。",
      "判断十进制数字字符，可以比较 ch >= '0' && ch <= '9'。这里依赖数字字符连续排列，不必背 ASCII 数值。",
      'scanf(" %c", &ch) 中的空格跳过之前的空白；%c 本身不会自动跳过换行。输出分类使用字符串格式。',
      "只读取一个非空白字符：是数字字符则输出 digit，否则输出 other。不要拿字符与整数 0、9 比较。",
    ],
    task: "读入一个非空白字符，若在字符 0 到 9 之间输出 digit，否则输出 other。",
    starter: program(
      "c",
      'char ch;\nscanf(" %c", &ch);\nif (ch >= 0 && ch <= 9) printf("digit");\nelse printf("other");',
    ),
    solution: program(
      "c",
      'char ch;\nscanf(" %c", &ch);\nif (ch >= \'0\' && ch <= \'9\') printf("digit");\nelse printf("other");',
    ),
    stdin: "7",
    tests: tests(
      ["7", "digit"],
      ["0", "digit"],
      ["a", "other"],
      [":", "other"],
    ),
    quizzes: [
      q(
        "单个字符 A 的 C 写法是？",
        ["'A'", '"A"', "A"],
        0,
        "单引号表示字符字面量。",
      ),
      q(
        "ch='0' 时，ch>='0' && ch<='9' 的值是？",
        ["假", "真", "无法比较"],
        1,
        "字符 0 位于闭区间两端之内。",
      ),
    ],
    demo: demo(
      "字符值参与区间比较",
      "char ch = '7';\nint is_digit = ch >= '0' && ch <= '9';\nprintf(\"%d\", is_digit);",
      [1, "ch 保存字符 7。", { ch: "'7'" }],
      [2, "两个字符比较都成立，逻辑与得到真。", { ch: "'7'", is_digit: 1 }],
      [3, "本例输出布尔判断的整数结果。", { is_digit: 1 }, { output: "1" }],
    ),
  },
  {
    language: "c",
    number: 10,
    order: 90,
    title: "字符串与结束符",
    chapter: "文本与数组",
    concepts: ["char 数组", "\\0", "strlen"],
    reading: [
      'C 字符串是以空字符 \\0 结束的字符序列。字符串 "cat" 需要至少 4 个 char 的存储空间。',
      "strlen 返回结束符之前的字符个数，不包含 \\0。对于 char word[32]，sizeof word 是整个数组大小，不是输入文本的长度。",
      'scanf("%31s", word) 最多读取 31 个非空白字符，并保留结束符位置。本课不接收带空格的文本。',
      "读取长度 1–31 的英文单词，输出它的长度。strlen 的结果是 size_t，应使用 %zu。",
    ],
    task: "读入一个不含空格的英文单词（1–31 个字符），输出字符数，不计结束符。",
    starter: program(
      "c",
      'char word[32];\nscanf("%31s", word);\nprintf("%zu\\n", sizeof word);',
    ),
    solution: program(
      "c",
      'char word[32];\nscanf("%31s", word);\nprintf("%zu\\n", strlen(word));',
    ),
    stdin: "cat",
    tests: tests(["cat", "3"], ["a", "1"], ["program", "7"]),
    quizzes: [
      q(
        '保存字符串 "cat"，数组至少需要几个 char？',
        ["3", "4", "32"],
        1,
        "三个字母后还要保存结束符。",
      ),
      q(
        'char word[32] 中保存 "hi"，strlen(word) 是？',
        ["32", "3", "2"],
        2,
        "strlen 只计算结束符前的两个字符。",
      ),
    ],
    demo: demo(
      "结束符划定字符串边界",
      'char word[4] = "cat";\nsize_t length = strlen(word);\nprintf("%zu", length);',
      [1, "三个字母加一个结束符。", {}, { items: ["c", "a", "t", "\\0"] }],
      [
        2,
        "遇到结束符停止计数，不把它计入长度。",
        { length: 3 },
        { items: ["c", "a", "t", "\\0"], active: 3 },
      ],
      [
        3,
        "输出逻辑长度。",
        { length: 3 },
        { output: "3", items: ["c", "a", "t", "\\0"] },
      ],
    ),
  },
  {
    language: "c",
    number: 11,
    order: 95,
    title: "二维数组与行列",
    chapter: "文本与数组",
    concepts: ["二维数组", "行列下标", "嵌套循环"],
    reading: [
      "int grid[2][2] 可以看成两行，每行两个整数。grid[row][col] 的第一个下标选行，第二个选列。",
      "本课输入四个数，按行放入 2×2 数组。主对角线是 grid[0][0] 和 grid[1][1]。",
      "行列下标都从 0 开始。grid[0][1] 位于第一行第二列，属于另一条对角线。不要混淆“第一行”和下标 1。",
      "读入四个整数，输出主对角线之和。练习先画出行列，再检查选中的两个位置。",
    ],
    task: "按行读入 2×2 整数矩阵，输出主对角线（左上到右下）的两个元素之和。",
    starter: program(
      "c",
      'int grid[2][2];\nfor (int r=0;r<2;r++)\n    for (int c=0;c<2;c++) scanf("%d", &grid[r][c]);\nprintf("%d", grid[0][1] + grid[1][0]);',
    ),
    solution: program(
      "c",
      'int grid[2][2];\nfor (int r=0;r<2;r++)\n    for (int c=0;c<2;c++) scanf("%d", &grid[r][c]);\nprintf("%d", grid[0][0] + grid[1][1]);',
    ),
    stdin: "1 2 3 4",
    tests: tests(["1 2 3 4", "5"], ["2 0 0 8", "10"], ["-3 7 5 3", "0"]),
    quizzes: [
      q(
        "grid[0][1] 表示哪个位置？",
        ["第一行第二列", "第二行第一列", "第二行第二列"],
        0,
        "先行后列，下标从 0 开始。",
      ),
      q(
        "矩阵 [[2,9],[7,4]] 的主对角线和是？",
        ["16", "6", "11"],
        1,
        "选取左上 2 与右下 4，得到 6。",
      ),
    ],
    demo: demo(
      "用两个下标定位一个元素",
      'int grid[2][2] = {{1,2},{3,4}};\nint sum = grid[0][0] + grid[1][1];\nprintf("%d", sum);',
      [
        1,
        "按行保存四个元素。",
        { "[0][0]": 1, "[0][1]": 2, "[1][0]": 3, "[1][1]": 4 },
      ],
      [
        2,
        "选中行列下标相等的两个位置。",
        { "grid[0][0]": 1, "grid[1][1]": 4, sum: 5 },
      ],
      [3, "输出主对角线和。", { sum: 5 }, { output: "5" }],
    ),
  },
  {
    language: "c",
    number: 12,
    order: 110,
    title: "作用域与值传递",
    chapter: "函数与调试",
    concepts: ["局部变量", "形参副本", "作用域"],
    reading: [
      "函数参数是本次调用中的局部变量。把一个 int 传给函数，会用实参的值初始化形参，不会让形参自动成为原变量的别名。",
      "函数中修改 n，只改变当前调用的副本。若希望调用方保存计算结果，可以返回新值，再由调用方赋值。",
      "同名不等于同一变量。main 中的 n 和 add_one 中的 n 分属不同作用域；调用结束后局部变量生命周期结束。",
      "修复 add_one，使它返回加一后的结果，并在 main 中把返回值赋回 n。本课随后为指针传参作对照。",
    ],
    task: "读入整数 n，调用 add_one 后保存返回值，使最终输出 n+1。输入范围 -100–100。",
    starter: program(
      "c",
      `${read("c")}\nadd_one(n);\n${print("c", "n")}`,
      "int add_one(int n) { return n + 1; }",
    ),
    solution: program(
      "c",
      `${read("c")}\nn = add_one(n);\n${print("c", "n")}`,
      "int add_one(int n) { return n + 1; }",
    ),
    stdin: "5",
    tests: tests(["5", "6"], ["-1", "0"], ["0", "1"]),
    quizzes: [
      q(
        "int n=5; add_one(n); 未保存返回值，n 仍是？",
        ["5", "6", "未定义"],
        0,
        "调用不会自动给 main 中的 n 赋值。",
      ),
      q(
        "要保存函数返回的新值，应写？",
        ["n = add_one(n);", "add_one;", "n == add_one(n);"],
        0,
        "赋值把返回结果保存到调用方变量。",
      ),
    ],
    demo: demo(
      "实参和形参是两个变量",
      'int n = 5;\nint result = add_one(n); // add_one 返回形参 + 1\nn = result;\nprintf("%d", n);',
      [1, "调用方持有 n。", { "main.n": 5 }],
      [
        2,
        "值传递产生形参副本，返回 6，调用方 n 暂时仍为 5。",
        { "main.n": 5, 形参副本: 5, result: 6 },
      ],
      [3, "显式赋值后，调用方 n 才改变。", { "main.n": 6, result: 6 }],
      [4, "输出赋值后的值。", { "main.n": 6 }, { output: "6" }],
    ),
  },
  {
    language: "c",
    number: 13,
    order: 120,
    title: "指针：取址与解引用",
    chapter: "指针与内存",
    concepts: ["指针", "& 取址", "* 解引用"],
    reading: [
      "指针变量保存对象的地址。int *p = &value 让 p 指向 value；&value 取地址，*p 则访问该地址所指的 int 对象。",
      "执行 *p = *p + 1，会先读取 value 的旧值，再把结果写回 value。只修改局部副本不会产生同样效果。",
      "使用指针前必须让它指向有效对象。未初始化指针、空指针和失效地址都不能随意解引用。示意图中的对象标签不是实际内存地址。",
      "读入整数，建立指向它的指针，经由该指针把原值加一。观察 p 保持指向同一个对象，而对象里的值发生变化。",
    ],
    task: "读入整数 value，通过指针 p 将 value 加一，再输出 value。输入范围 -100–100。",
    starter: program(
      "c",
      `${read("c", "value")}\nint *p = &value;\nint copy = *p;\ncopy += 1;\n(void)copy;\n${print("c", "value")}`,
    ),
    solution: program(
      "c",
      `${read("c", "value")}\nint *p = &value;\n*p += 1;\n${print("c", "value")}`,
    ),
    stdin: "5",
    tests: tests(["5", "6"], ["0", "1"], ["-4", "-3"]),
    quizzes: [
      q(
        "int *p=&value 中，p 保存的是？",
        ["value 的地址", "value+1", "字符 p"],
        0,
        "&value 产生 value 的地址。",
      ),
      q(
        "*p=9 后，如果 p 指向 value，value 是？",
        ["原值", "9", "p 的地址"],
        1,
        "解引用赋值写入所指对象。",
      ),
    ],
    demo: demo(
      "沿指针找到被修改的对象",
      'int value = 5;\nint *p = &value;\n*p += 1;\nprintf("%d", value);',
      [1, "先创建有效的整数对象。", { value: 5 }],
      [
        2,
        "p 保存 value 的地址；箭头是指向关系示意。",
        { value: 5, p: "→ value" },
        {
          links: [
            { from: "p", to: "value", label: "指向", fields: { value: 5 } },
          ],
        },
      ],
      [
        3,
        "通过 *p 写回同一个 value 对象，p 本身没有改指向。",
        { value: 6, p: "→ value" },
        {
          links: [
            { from: "p", to: "value", label: "*p += 1", fields: { value: 6 } },
          ],
          change: "value: 5 → 6",
        },
      ],
      [
        4,
        "读 value 得到更新后的 6。",
        { value: 6 },
        {
          output: "6",
          links: [
            { from: "p", to: "value", label: "指向", fields: { value: 6 } },
          ],
        },
      ],
    ),
  },
  {
    language: "c",
    number: 14,
    order: 130,
    title: "指针与数组元素",
    chapter: "指针与内存",
    concepts: ["数组首元素", "指针加法", "边界"],
    reading: [
      "在本课表达式中，数组名可转换为指向首元素的指针。int *p = numbers 让 p 指向 numbers[0]。",
      "p+1 指向下一个 int 元素，不是简单移动一个字节。*(p+2) 在本例等价于 numbers[2]。",
      "合法元素只有 0、1、2。可形成尾后指针，但不能解引用它；不要用本例推断任意地址都可以读取。",
      "输入作为第三个元素，通过 *(p+2) 读取它。本课不涉及动态分配，数组在 main 的有效作用域内使用。",
    ],
    task: "读入整数 n，数组设为 {2,4,n}；通过指针 p 读取并输出第三个元素。",
    starter: program(
      "c",
      `${read("c")}\nint numbers[] = {2, 4, n};\nint *p = numbers;\n${print("c", "*(p + 1)")}`,
    ),
    solution: program(
      "c",
      `${read("c")}\nint numbers[] = {2, 4, n};\nint *p = numbers;\n${print("c", "*(p + 2)")}`,
    ),
    stdin: "6",
    tests: tests(["6", "6"], ["0", "0"], ["-3", "-3"]),
    quizzes: [
      q(
        "p 指向 numbers[0]，p+1 指向？",
        ["下一个 int 元素", "下一个字节，永远如此", "数组之外"],
        0,
        "移动的单位是指向的元素类型大小。",
      ),
      q(
        "长度为 3 的数组，哪个可合法读取？",
        ["*(p+3)", "*(p+2)", "*(p-1)"],
        1,
        "第三个元素的下标是 2。",
      ),
    ],
    demo: demo(
      "偏移以元素为单位",
      'int numbers[] = {2,4,6};\nint *p = numbers;\nint result = *(p + 2);\nprintf("%d", result);',
      [1, "三个元素对应下标 0、1、2。", {}, { items: [2, 4, 6] }],
      [
        2,
        "p 指向首元素。",
        { p: "→ numbers[0]" },
        { items: [2, 4, 6], active: 0 },
      ],
      [
        3,
        "p+2 选到第三个元素，解引用读出 6。",
        { result: 6 },
        { items: [2, 4, 6], active: 2 },
      ],
      [
        4,
        "输出读取结果。",
        { result: 6 },
        { output: "6", items: [2, 4, 6], active: 2 },
      ],
    ),
  },
  {
    language: "c",
    number: 15,
    order: 140,
    title: "指针参数与原地修改",
    chapter: "指针与内存",
    concepts: ["地址传参", "间接修改", "函数调用"],
    reading: [
      "把 &n 传给 int *p 参数，形参得到地址的副本，但调用方和被调函数可以沿该地址访问同一个 n。",
      "void increment(int *p) 中执行 (*p)++，会修改指针所指的整数。调用 increment(&n) 明确地传入 n 的地址。",
      "不要把 p++ 与 (*p)++ 混淆：前者改变指针位置，后者改变指向的整数。本课只对有效 int 对象做后者。",
      "补全函数体，经由指针把调用方 n 加一。对照值传递一课，区分复制值与通过地址访问原对象。",
    ],
    task: "实现 void increment(int *p)，通过指针参数将 main 的 n 加一。",
    starter: program(
      "c",
      `${read("c")}\nincrement(&n);\n${print("c", "n")}`,
      "void increment(int *p) { int copy = *p; copy++; (void)copy; }",
    ),
    solution: program(
      "c",
      `${read("c")}\nincrement(&n);\n${print("c", "n")}`,
      "void increment(int *p) { (*p)++; }",
    ),
    stdin: "5",
    tests: tests(["5", "6"], ["0", "1"], ["-2", "-1"]),
    quizzes: [
      q(
        "increment(&n) 传给函数的是？",
        ["n 的地址", "n+1", "n 的字符串"],
        0,
        "取址符获得调用方对象的地址。",
      ),
      q(
        "想改变 p 指向的整数，应该写？",
        ["p++;", "(*p)++;", "p = 0;"],
        1,
        "括号明确先解引用，再增加整数。",
      ),
    ],
    demo: demo(
      "函数通过地址修改调用方",
      'int n = 5;\n// 调用 increment(&n)，形参 p 指向 n\n(*p)++; // 函数体片段\nprintf("%d", n);',
      [1, "调用方的整数对象已经存在。", { "main.n": 5 }],
      [
        2,
        "进入 increment；形参 p 指向调用方 n。",
        { "main.n": 5 },
        {
          links: [
            {
              from: "increment.p",
              to: "main.n",
              label: "地址传入",
              fields: { n: 5 },
            },
          ],
        },
      ],
      [
        3,
        "函数体通过指针修改 n。",
        { "main.n": 6 },
        {
          links: [
            {
              from: "increment.p",
              to: "main.n",
              label: "间接写入",
              fields: { n: 6 },
            },
          ],
        },
      ],
      [4, "调用结束，n 的新值仍然保留。", { "main.n": 6 }, { output: "6" }],
    ),
  },
  {
    language: "c",
    number: 16,
    order: 150,
    title: "结构体与成员访问",
    chapter: "结构化数据",
    concepts: ["struct", "成员", "点运算符"],
    reading: [
      "结构体把一组相关字段组织为一个类型。例如 struct Point { int x; int y; }; 可以描述一个二维坐标。",
      "struct Point point = {2,3} 创建一个对象。使用 point.x 和 point.y 访问不同成员，成员有独立的值。",
      "定义类型不等于创建对象；结构体定义结尾需要分号。不能把两个字段混成一个数组下标，也不能忘记给成员初始化。",
      "读入 x、y，构造一个 Point，输出两个成员之和。先认识成员访问，再学习结构体指针与对象数组。",
    ],
    task: "读入两个整数 x y，保存到 struct Point 的两个成员，输出 point.x + point.y。",
    starter: program(
      "c",
      'struct Point point;\nscanf("%d %d", &point.x, &point.y);\nprintf("%d", point.x + point.x);',
      "struct Point { int x; int y; };",
    ),
    solution: program(
      "c",
      'struct Point point;\nscanf("%d %d", &point.x, &point.y);\nprintf("%d", point.x + point.y);',
      "struct Point { int x; int y; };",
    ),
    stdin: "2 3",
    tests: tests(["2 3", "5"], ["0 7", "7"], ["-2 2", "0"]),
    quizzes: [
      q(
        "struct Point { int x; int y; }; 做了什么？",
        ["定义一种有两个成员的类型", "输出坐标", "已经创建 point"],
        0,
        "类型定义描述字段布局，还需要声明对象。",
      ),
      q(
        "point.x=2, point.y=7，修改 point.x 后，point.y 会自动变化吗？",
        ["会", "不会", "不能访问 y"],
        1,
        "不同成员分别保存自己的值。",
      ),
    ],
    demo: demo(
      "把相关字段放进同一个对象",
      'struct Point { int x; int y; };\nstruct Point point = {2,3};\nint sum = point.x + point.y;\nprintf("%d", sum);',
      [1, "先定义类型，此时还没有 point 对象。", { 类型: "Point: x, y" }],
      [
        2,
        "创建对象并分别初始化成员。",
        {},
        {
          links: [
            {
              from: "point",
              to: "Point 对象",
              label: "包含成员",
              fields: { x: 2, y: 3 },
            },
          ],
        },
      ],
      [
        3,
        "读取两个不同成员后相加。",
        { sum: 5 },
        {
          links: [
            {
              from: "point",
              to: "Point 对象",
              label: "读取 x 和 y",
              fields: { x: 2, y: 3 },
            },
          ],
        },
      ],
      [4, "输出计算结果。", { sum: 5 }, { output: "5" }],
    ),
  },
  {
    language: "c",
    number: 17,
    order: 160,
    title: "结构体指针与箭头运算符",
    chapter: "结构化数据",
    concepts: ["结构体指针", "->", "成员更新"],
    reading: [
      "struct Point *p=&point 让 p 指向结构体对象。p->x 等价于 (*p).x，表示沿指针访问成员 x。",
      "点运算符用于对象：point.x；箭头运算符用于结构体指针：p->x。二者最终可以访问同一个成员。",
      "把 point 复制到 copy 后修改 copy.x，不会改变 point.x。本课要保留指向原对象的指针，并通过它更新成员。",
      "读入初始 x，Point 的 y 固定为 3。通过 p 把 x 加 2，再输出原对象的 x，确认间接写入生效。",
    ],
    task: "读入 point.x，令 point.y=3；使用结构体指针 p 将原对象的 x 加 2，再输出 point.x。",
    starter: program(
      "c",
      'struct Point point;\nscanf("%d", &point.x);\npoint.y=3;\nstruct Point *p=&point;\nstruct Point copy=*p;\ncopy.x+=2;\nprintf("%d", point.x);',
      "struct Point { int x; int y; };",
    ),
    solution: program(
      "c",
      'struct Point point;\nscanf("%d", &point.x);\npoint.y=3;\nstruct Point *p=&point;\np->x+=2;\nprintf("%d", point.x);',
      "struct Point { int x; int y; };",
    ),
    stdin: "2",
    tests: tests(["2", "4"], ["0", "2"], ["-2", "0"]),
    quizzes: [
      q(
        "p 是结构体指针，访问 x 应写？",
        ["p.x", "p->x", "p[x]"],
        1,
        "箭头先沿指针找到对象，再访问成员。",
      ),
      q(
        "p->x 等价于哪种写法？",
        ["(*p).x", "*(p.x)", "&p.x"],
        0,
        "先解引用，再使用点访问。",
      ),
    ],
    demo: demo(
      "指针连接到整个结构体对象",
      'struct Point point = {2,3};\nstruct Point *p = &point;\np->x += 2;\nprintf("%d", point.x);',
      [1, "point 内有两个独立成员。", { "point.x": 2, "point.y": 3 }],
      [
        2,
        "p 指向完整对象。",
        {},
        {
          links: [
            { from: "p", to: "point", label: "指向", fields: { x: 2, y: 3 } },
          ],
        },
      ],
      [
        3,
        "只更新 x，y 保持 3。",
        {},
        {
          links: [
            {
              from: "p",
              to: "point",
              label: "p->x += 2",
              fields: { x: 4, y: 3 },
            },
          ],
          change: "x: 2 → 4",
        },
      ],
      [4, "从原对象读取 x，得到 4。", { "point.x": 4 }, { output: "4" }],
    ),
  },
  {
    language: "c",
    number: 18,
    order: 170,
    title: "结构体数组与数据遍历",
    chapter: "结构化数据",
    concepts: ["结构体数组", "成员累加", "遍历"],
    reading: [
      "数组的每个元素也可以是结构体。struct Student students[3] 表示三个独立的学生对象，每个都有 score 成员。",
      "students[i].score 先选择第 i 个结构体，再访问它的分数字段。循环 i=0、1、2，可以累计全部分数。",
      "数组长度与最后下标仍然不同。只遍历前两项会漏掉第三个学生；结构体不会改变数组的边界规则。",
      "读入三名学生的整数分数，保存到结构体数组并求和。这个组合把循环、数组与成员访问连接起来。",
    ],
    task: "读入三个整数分数，存入 struct Student 数组，输出三人总分。",
    starter: program(
      "c",
      'struct Student students[3];\nfor(int i=0;i<3;i++) scanf("%d", &students[i].score);\nint total=0;\nfor(int i=0;i<2;i++) total+=students[i].score;\nprintf("%d", total);',
      "struct Student { int score; };",
    ),
    solution: program(
      "c",
      'struct Student students[3];\nfor(int i=0;i<3;i++) scanf("%d", &students[i].score);\nint total=0;\nfor(int i=0;i<3;i++) total+=students[i].score;\nprintf("%d", total);',
      "struct Student { int score; };",
    ),
    stdin: "60 70 80",
    tests: tests(["60 70 80", "210"], ["0 0 100", "100"], ["10 20 0", "30"]),
    quizzes: [
      q(
        "students[1].score 访问的是？",
        ["第一人的全部信息", "第二人的 score", "第一个 score 的地址"],
        1,
        "先按下标选第二个对象，再访问成员。",
      ),
      q(
        "三个人分数 10、20、30，总分是？",
        ["30", "60", "50"],
        1,
        "必须遍历全部三个元素。",
      ),
    ],
    demo: demo(
      "先选对象，再读成员",
      '// students 的三个 score 为 60、70、80\nint total = 0;\n// 遍历 students[0..2]，逐项累加 score\nprintf("%d", total);',
      [
        1,
        "三个对象各自保存一个 score。",
        {},
        { items: ["score:60", "score:70", "score:80"] },
      ],
      [2, "总分从 0 开始。", { total: 0 }],
      [
        3,
        "处理第一个对象。",
        { total: 60 },
        { items: [60, 70, 80], active: 0 },
      ],
      [
        3,
        "处理第二个对象。",
        { total: 130 },
        { items: [60, 70, 80], active: 1 },
      ],
      [
        3,
        "处理第三个对象。",
        { total: 210 },
        { items: [60, 70, 80], active: 2 },
      ],
      [4, "输出三项总和。", { total: 210 }, { output: "210" }],
    ),
  },
);

// C++: containers, indirection and the first object model.
definitions.push(
  {
    language: "cpp",
    number: 9,
    order: 80,
    title: "string 与文本处理",
    chapter: "文本与容器",
    concepts: ["std::string", "size", "字符访问"],
    reading: [
      "std::string 管理一段文本及其长度，比手动管理 char 数组更适合初学者进行常见字符串操作。需要包含 <string>。",
      "word.size() 返回字符数。word[0] 访问第一个字符；只能在字符串非空时这样访问，下标等于 size() 已不是普通字符位置。",
      "std::cin >> word 读取一个不含空白的单词。sizeof(word) 得到 string 对象本身的大小，不能代表文本长度。",
      "本课输入是非空英文单词，输出其长度。中文编码的字节与字数不是同一概念，暂不扩展到 Unicode 字数计算。",
    ],
    task: "读入一个非空英文单词，输出它的字符数。",
    starter: program(
      "cpp",
      "std::string word;\nstd::cin >> word;\nstd::cout << sizeof(word);",
    ),
    solution: program(
      "cpp",
      "std::string word;\nstd::cin >> word;\nstd::cout << word.size();",
    ),
    stdin: "cat",
    tests: tests(["cat", "3"], ["a", "1"], ["program", "7"]),
    quizzes: [
      q(
        "取得 string 中字符个数应使用？",
        ["sizeof(word)", "word.size()", "word[0]"],
        1,
        "size() 返回当前文本的长度。",
      ),
      q(
        'word="code"，word[1] 是？',
        ["c", "o", "d"],
        1,
        "下标从 0 开始，第二个字符是 o。",
      ),
    ],
    demo: demo(
      "字符串长度随文本内容变化",
      'std::string word = "cat";\nword += "s";\nstd::cout << word.size();',
      [
        1,
        "创建包含三个字符的字符串。",
        { size: 3 },
        { items: ["c", "a", "t"] },
      ],
      [
        2,
        "追加 s，长度变为四。",
        { size: 4 },
        { items: ["c", "a", "t", "s"], active: 3 },
      ],
      [
        3,
        "输出当前字符数。",
        { size: 4 },
        { output: "4", items: ["c", "a", "t", "s"] },
      ],
    ),
  },
  {
    language: "cpp",
    number: 10,
    order: 90,
    title: "vector 与动态序列",
    chapter: "文本与容器",
    concepts: ["std::vector", "push_back", "size"],
    reading: [
      "std::vector<int> 是可增长的整数序列。先学习如何使用容器，不需要实现模板或学习复杂泛型编程。",
      "push_back(n) 把 n 加到末尾。原来 {2,4} 有两项，追加 6 后是 {2,4,6}，size() 变为 3。",
      "下标 0 仍表示第一项。不要把 size() 当最后下标，也不要在越界位置用 [] 当成自动追加。",
      "读入一个整数，追加到初始 vector 的末尾，再用范围 for 遍历所有项求和。",
    ],
    task: "给 vector {2,4} 追加输入 n，输出所有元素的总和。",
    starter: program(
      "cpp",
      `${read("cpp")}\nstd::vector<int> values={2,4};\n// 在这里追加 n\nint total=0;\nfor(int value:values) total+=value;\n${print("cpp", "total")}`,
    ),
    solution: program(
      "cpp",
      `${read("cpp")}\nstd::vector<int> values={2,4};\nvalues.push_back(n);\nint total=0;\nfor(int value:values) total+=value;\n${print("cpp", "total")}`,
    ),
    stdin: "6",
    tests: tests(["6", "12"], ["0", "6"], ["-6", "0"]),
    quizzes: [
      q(
        "向 vector 末尾增加一项应调用？",
        ["push_back", "size", "clear"],
        0,
        "push_back 添加一个元素，size 只查询数量。",
      ),
      q(
        "values={2,4}，追加 6 后 size() 是？",
        ["2", "3", "6"],
        1,
        "追加一项后元素数从 2 变为 3。",
      ),
    ],
    demo: demo(
      "追加会扩展序列的逻辑长度",
      "std::vector<int> values = {2,4};\nvalues.push_back(6);\nint total = 0;\nfor (int value : values) total += value;\nstd::cout << total;",
      [1, "当前有两项。", { size: 2 }, { items: [2, 4] }],
      [2, "末尾新增 6。", { size: 3 }, { items: [2, 4, 6], active: 2 }],
      [3, "累加器初始化为 0。", { total: 0 }],
      [4, "范围 for 依次读取 2、4、6。", { total: 12 }, { items: [2, 4, 6] }],
      [5, "输出所有项的总和。", { total: 12 }, { output: "12" }],
    ),
  },
  {
    language: "cpp",
    number: 11,
    order: 110,
    title: "引用与参数传递",
    chapter: "引用与指针",
    concepts: ["引用", "别名", "引用参数"],
    reading: [
      "int& ref = value 为已有整数创建引用。引用可以理解为同一个对象的另一个名字，声明时必须绑定对象。",
      "函数参数 int& n 绑定到调用方传入的整数。函数中 n += 1 会修改原对象，与 int n 的值传递不同。",
      "引用的 & 出现在声明中，不是一次取址操作。引用在初始化之后不能通过赋值重新绑定另一个对象。",
      "把 increment 的参数从 int 改为 int&，让它真正修改调用方的 n。可视化用两个名字连接同一对象。",
    ],
    task: "修复 increment 的参数声明，让函数将调用方整数 n 加一。",
    starter: program(
      "cpp",
      `${read("cpp")}\nincrement(n);\n${print("cpp", "n")}`,
      "void increment(int n) { n += 1; }",
    ),
    solution: program(
      "cpp",
      `${read("cpp")}\nincrement(n);\n${print("cpp", "n")}`,
      "void increment(int& n) { n += 1; }",
    ),
    stdin: "5",
    tests: tests(["5", "6"], ["0", "1"], ["-2", "-1"]),
    quizzes: [
      q(
        "int& ref=value 创建的是？",
        ["一个独立副本", "value 的引用", "一个新字符串"],
        1,
        "ref 是同一对象的另一个名字。",
      ),
      q(
        "经 int& 参数修改 n，调用方原整数会怎样？",
        ["同时改变", "保持不变", "被删除"],
        0,
        "引用参数绑定到原对象，修改作用于它。",
      ),
    ],
    demo: demo(
      "两个名字访问同一个整数",
      "int value = 5;\nint& ref = value;\nref += 1;\nstd::cout << value;",
      [1, "创建整数对象。", { value: 5 }],
      [
        2,
        "ref 绑定到 value；没有创建整数副本。",
        {},
        {
          links: [
            {
              from: "ref",
              to: "value",
              label: "引用 / 别名",
              fields: { value: 5 },
            },
          ],
        },
      ],
      [
        3,
        "通过 ref 写入，value 也读到 6。",
        {},
        {
          links: [
            {
              from: "ref",
              to: "value",
              label: "ref += 1",
              fields: { value: 6 },
            },
          ],
        },
      ],
      [4, "输出原变量名对应的值。", { value: 6 }, { output: "6" }],
    ),
  },
  {
    language: "cpp",
    number: 12,
    order: 120,
    title: "指针与对象地址",
    chapter: "引用与指针",
    concepts: ["指针", "取址", "解引用"],
    reading: [
      "int* p = &value 保存 value 的地址。与引用不同，指针是单独的变量，可以在合法条件下改变指向，也可以为空。",
      "*p 访问所指对象，*p += 2 会修改 value。p 保存的地址与 *p 读出的整数值是两件事。",
      "未初始化或为空的指针不能解引用。学习图只画对象关系，不承诺真实地址数值，也不代表任意用户程序的调试轨迹。",
      "本课建立指向局部整数的有效指针，通过解引用加二。暂不引入 new/delete，优先学清对象和地址的关系。",
    ],
    task: "读入 value，通过指针 p 给原值加 2，再输出 value。",
    starter: program(
      "cpp",
      `${read("cpp", "value")}\nint* p=&value;\nint copy=*p;\ncopy+=2;\n${print("cpp", "value")}`,
    ),
    solution: program(
      "cpp",
      `${read("cpp", "value")}\nint* p=&value;\n*p+=2;\n${print("cpp", "value")}`,
    ),
    stdin: "5",
    tests: tests(["5", "7"], ["0", "2"], ["-2", "0"]),
    quizzes: [
      q(
        "p=&value 后，*p 表示？",
        ["p 本身的地址", "value 对象", "一个任意字符"],
        1,
        "解引用访问 p 所指对象。",
      ),
      q(
        "空指针 nullptr 可以直接解引用吗？",
        ["可以", "不可以", "只要先输出即可"],
        1,
        "必须指向有效且仍存活的对象才能解引用。",
      ),
    ],
    demo: demo(
      "地址和值分别观察",
      "int value = 5;\nint* p = &value;\n*p += 2;\nstd::cout << value;",
      [1, "创建有效对象。", { value: 5 }],
      [
        2,
        "p 保存指向 value 的地址。",
        {},
        {
          links: [
            { from: "p", to: "value", label: "指向", fields: { value: 5 } },
          ],
        },
      ],
      [
        3,
        "沿指针写入 7。",
        {},
        {
          links: [
            { from: "p", to: "value", label: "*p += 2", fields: { value: 7 } },
          ],
        },
      ],
      [4, "从原对象读出新值。", { value: 7 }, { output: "7" }],
    ),
  },
  {
    language: "cpp",
    number: 13,
    order: 130,
    title: "struct 与成员函数",
    chapter: "类与对象",
    concepts: ["struct", "数据成员", "成员函数"],
    reading: [
      "C++ 的 struct 可以把数据与相关操作放在一个类型中。成员默认 public，可以用对象名加点访问。",
      "Point 的 x、y 是每个对象自己的数据成员；sum() 可以直接读取当前对象的 x 和 y。",
      "定义成员函数不等于调用它，point.sum() 后的括号不能省略。两个成员分别参与运算，不能误写为 x+x。",
      "读入一个 Point 的两个坐标，补全 sum() 成员函数，使它返回 x+y。这个结构体将自然过渡到 class。",
    ],
    task: "读入 x、y，补全 Point::sum()，输出两个成员之和。",
    starter: program(
      "cpp",
      "Point point;\nstd::cin >> point.x >> point.y;\nstd::cout << point.sum();",
      "struct Point { int x; int y; int sum() { return x+x; } };",
    ),
    solution: program(
      "cpp",
      "Point point;\nstd::cin >> point.x >> point.y;\nstd::cout << point.sum();",
      "struct Point { int x; int y; int sum() { return x+y; } };",
    ),
    stdin: "2 3",
    tests: tests(["2 3", "5"], ["0 7", "7"], ["-2 2", "0"]),
    quizzes: [
      q(
        "C++ struct 中没有显式访问标签的成员默认是？",
        ["private", "public", "不可访问"],
        1,
        "struct 默认 public，class 默认 private。",
      ),
      q(
        "调用 point 的 sum 成员函数应写？",
        ["point.sum()", "sum.point", "point.sum"],
        0,
        "点选择成员，括号执行函数调用。",
      ),
    ],
    demo: demo(
      "成员函数读取当前对象的数据",
      "struct Point { int x, y; int sum() { return x+y; } };\nPoint point{2,3};\nint result = point.sum();\nstd::cout << result;",
      [1, "类型描述字段和操作。", { 类型: "Point" }],
      [
        2,
        "创建对象后拥有自己的 x 和 y。",
        {},
        {
          links: [
            {
              from: "point",
              to: "Point 对象",
              label: "成员",
              fields: { x: 2, y: 3 },
            },
          ],
        },
      ],
      [
        3,
        "sum 读取当前 point 的成员，返回 5。",
        { result: 5 },
        {
          links: [
            {
              from: "point.sum()",
              to: "point",
              label: "读取",
              fields: { x: 2, y: 3 },
            },
          ],
        },
      ],
      [4, "输出返回值。", { result: 5 }, { output: "5" }],
    ),
  },
  {
    language: "cpp",
    number: 14,
    order: 140,
    title: "class 与对象状态",
    chapter: "类与对象",
    concepts: ["class", "对象", "public"],
    reading: [
      "类定义一种包含数据与操作的类型，对象是这个类型的具体实例。每次创建 Counter，都有独立的 value 成员。",
      "class 默认成员访问权限是 private。本课先显式写 public，使 main 可以设置 value 和调用 add()，随后再学习封装。",
      "成员函数 add() 操作当前对象的成员。写一个同名局部变量只会遮蔽成员，不能给对象状态加一。",
      "修复 Counter::add，让输入值在对象中加一。不要只在输出时临时加一，否则实际对象状态没有更新。",
    ],
    task: "读入 Counter.value，修复 add() 成员函数，让它更新对象的 value，再输出该成员。",
    starter: program(
      "cpp",
      "Counter counter;\nstd::cin >> counter.value;\ncounter.add();\nstd::cout << counter.value;",
      "class Counter { public: int value=0; void add() { int value=0; value++; } };",
    ),
    solution: program(
      "cpp",
      "Counter counter;\nstd::cin >> counter.value;\ncounter.add();\nstd::cout << counter.value;",
      "class Counter { public: int value=0; void add() { value++; } };",
    ),
    stdin: "5",
    tests: tests(["5", "6"], ["0", "1"], ["-1", "0"]),
    quizzes: [
      q(
        "类与对象的关系更接近？",
        ["类型与具体实例", "两个毫不相关的变量", "输出与输入"],
        0,
        "类描述共同结构，对象各自持有状态。",
      ),
      q(
        "成员函数中声明 int value=0，会自动更新同名成员吗？",
        ["会", "不会", "类不能有成员"],
        1,
        "局部变量会遮蔽同名成员；本课应直接更新成员。",
      ),
    ],
    demo: demo(
      "方法改变当前对象的状态",
      "class Counter { public: int value=5; void add(){ value++; } };\nCounter counter;\ncounter.add();\nstd::cout << counter.value;",
      [1, "定义类型和自增操作。", { 类型: "Counter" }],
      [
        2,
        "创建具体对象，初值为 5。",
        {},
        {
          links: [
            {
              from: "counter",
              to: "Counter 对象",
              label: "实例",
              fields: { value: 5 },
            },
          ],
        },
      ],
      [
        3,
        "add 修改此对象的 value。",
        {},
        {
          links: [
            {
              from: "counter.add()",
              to: "counter",
              label: "更新成员",
              fields: { value: 6 },
            },
          ],
          change: "value: 5 → 6",
        },
      ],
      [4, "读取更新后的对象状态。", { "counter.value": 6 }, { output: "6" }],
    ),
  },
  {
    language: "cpp",
    number: 15,
    order: 150,
    title: "构造函数与初始化",
    chapter: "类与对象",
    concepts: ["构造函数", "初始化列表", "对象创建"],
    reading: [
      "构造函数在创建对象时执行，用于建立有效初始状态。它与类同名，不写返回类型。",
      "Counter(int start) : value(start) {} 使用成员初始化列表，把传入参数保存到 value。初始化发生在构造函数体执行之前。",
      "把 value 固定初始化为 0 会忽略 start，导致不同输入创建出的对象状态相同。参数名和成员名可以不同，避免混淆。",
      "读入初始值，创建 Counter counter(n)，然后读取 value。本课专注初始化，不引入拷贝构造与资源管理细节。",
    ],
    task: "补全 Counter 构造函数，让 Counter(n) 把 n 保存到 value。",
    starter: program(
      "cpp",
      `${read("cpp")}\nCounter counter(n);\nstd::cout << counter.value;`,
      "class Counter { public: int value; Counter(int start) : value(0) { (void)start; } };",
    ),
    solution: program(
      "cpp",
      `${read("cpp")}\nCounter counter(n);\nstd::cout << counter.value;`,
      "class Counter { public: int value; Counter(int start) : value(start) {} };",
    ),
    stdin: "7",
    tests: tests(["7", "7"], ["-3", "-3"], ["0", "0"]),
    quizzes: [
      q(
        "构造函数在何时执行？",
        ["对象创建时", "只在输出时", "程序退出后"],
        0,
        "构造过程建立对象的初始状态。",
      ),
      q(
        "value(start) 中哪个是成员？",
        ["value", "start", "二者都不是"],
        0,
        "value 是成员，start 是本次构造调用的参数。",
      ),
    ],
    demo: demo(
      "参数进入对象的初始状态",
      "class Counter { public: int value; Counter(int start):value(start){} };\nCounter counter(7);\nstd::cout << counter.value;",
      [1, "定义初始化规则。", { 规则: "value ← start" }],
      [
        2,
        "创建时传入 7，成员完成初始化。",
        { start: 7 },
        {
          links: [
            {
              from: "counter",
              to: "Counter 对象",
              label: "构造完成",
              fields: { value: 7 },
            },
          ],
        },
      ],
      [3, "读取已经初始化的成员。", { "counter.value": 7 }, { output: "7" }],
    ),
  },
  {
    language: "cpp",
    number: 16,
    order: 160,
    title: "封装与受控修改",
    chapter: "类与对象",
    concepts: ["private", "public 接口", "数据约束"],
    reading: [
      "封装把内部数据与公开操作分开。private 成员不能由 main 直接访问，调用方使用 public 方法完成约定动作。",
      "本课 Account 保存 balance，deposit(amount) 只接受正数。get() 提供只读查询，让外部不需要知道字段的实现方式。",
      "private 本身不会自动验证业务规则；规则仍要写在方法里。如果接受负数存入，就会绕过“只增加余额”的约定。",
      "初始余额为 10。补全 deposit，让 amount>0 时增加余额，零或负数保持原值；最后用 get() 查询。",
    ],
    task: "实现 Account::deposit：仅当输入金额大于 0 时增加余额，初始余额为 10。",
    starter: program(
      "cpp",
      `${read("cpp")}\nAccount account;\naccount.deposit(n);\nstd::cout << account.get();`,
      "class Account { int balance=10; public: void deposit(int amount) { balance+=amount; } int get() const { return balance; } };",
    ),
    solution: program(
      "cpp",
      `${read("cpp")}\nAccount account;\naccount.deposit(n);\nstd::cout << account.get();`,
      "class Account { int balance=10; public: void deposit(int amount) { if(amount>0) balance+=amount; } int get() const { return balance; } };",
    ),
    stdin: "5",
    tests: tests(["5", "15"], ["-3", "10"], ["0", "10"]),
    quizzes: [
      q(
        "main 访问 private balance 应通过？",
        ["对象公开的方法", "任意写 account.balance", "删除 public"],
        0,
        "公开接口控制允许的读取和修改。",
      ),
      q(
        "规则只接受正数，deposit(-3) 后初始余额 10 应是？",
        ["7", "13", "10"],
        2,
        "不合法的存入量不应改变余额。",
      ),
    ],
    demo: demo(
      "公开方法检查修改条件",
      "// account 的 private balance 初始为 10\naccount.deposit(-3); // 仅接受正数\naccount.deposit(5);\nstd::cout << account.get();",
      [
        1,
        "对象内部保存初始余额。",
        {},
        {
          links: [
            {
              from: "account",
              to: "内部状态",
              label: "private",
              fields: { balance: 10 },
            },
          ],
        },
      ],
      [2, "负数不满足条件，余额保持 10。", { amount: -3, balance: 10 }],
      [3, "5 大于 0，合法增加余额。", { amount: 5, balance: 15 }],
      [4, "通过公开查询方法取得结果。", { balance: 15 }, { output: "15" }],
    ),
  },
  {
    language: "cpp",
    number: 17,
    order: 170,
    title: "对象组合",
    chapter: "类与对象",
    concepts: ["组合", "成员对象", "分层访问"],
    reading: [
      "一个对象可以把另一种对象作为成员。这叫组合：例如 Player 有一个 Position，而不是把所有字段平铺到同一层。",
      "player.position.x 先找到 player 的 position 成员对象，再找到它的 x。每一层点运算都选择一个成员。",
      "组合表示“拥有一个”。它不需要继承，也不要求使用指针。嵌套成员同样需要初始化，以免读取未确定的值。",
      "Player 默认 position 为 (0,0)。读入 dx，调用 move(dx) 更新 position.x，保持 position.y 不变。",
    ],
    task: "实现 Player::move(dx)，让内部 position.x 增加 dx，输出 x 和 y（空格分隔）。",
    starter: program(
      "cpp",
      `${read("cpp")}\nPlayer player;\nplayer.move(n);\nstd::cout << player.position.x << " " << player.position.y;`,
      "struct Position { int x=0; int y=0; };\nstruct Player { Position position; void move(int dx) { position.y+=dx; } };",
    ),
    solution: program(
      "cpp",
      `${read("cpp")}\nPlayer player;\nplayer.move(n);\nstd::cout << player.position.x << " " << player.position.y;`,
      "struct Position { int x=0; int y=0; };\nstruct Player { Position position; void move(int dx) { position.x+=dx; } };",
    ),
    stdin: "3",
    tests: tests(["3", "3 0"], ["-2", "-2 0"], ["0", "0 0"]),
    quizzes: [
      q(
        "Player 中有 Position 成员，表达的是？",
        ["拥有一个位置对象", "必须继承 Position", "两个名称指同一个类"],
        0,
        "组合把其他对象作为成员组织起来。",
      ),
      q(
        "只横向移动 3，初始 (0,0) 应变成？",
        ["(0,3)", "(3,0)", "(3,3)"],
        1,
        "横向移动更新 x，y 保持不变。",
      ),
    ],
    demo: demo(
      "沿成员层次定位状态",
      'Player player; // position 初始为 (0,0)\nplayer.move(3); // position.x += 3\nstd::cout << player.position.x << " " << player.position.y;',
      [
        1,
        "Player 拥有一个 Position 成员对象。",
        {},
        {
          links: [
            {
              from: "player",
              to: "player.position",
              label: "拥有",
              fields: { x: 0, y: 0 },
            },
          ],
        },
      ],
      [
        2,
        "move 沿 position 找到 x 并更新。",
        {},
        {
          links: [
            {
              from: "player.move(3)",
              to: "player.position",
              label: "更新 x",
              fields: { x: 3, y: 0 },
            },
          ],
        },
      ],
      [
        3,
        "依次读出两个坐标。",
        { "position.x": 3, "position.y": 0 },
        { output: "3 0" },
      ],
    ),
  },
  {
    language: "cpp",
    number: 18,
    order: 180,
    title: "对象数组与独立状态",
    chapter: "类与对象",
    concepts: ["vector 对象", "实例状态", "成员遍历"],
    reading: [
      "vector 中也能存放对象，例如 std::vector<Counter>。每一项是一个独立的 Counter，成员值不会自动共享。",
      "counters[0].add(n) 只修改第一个对象。本课两个 Counter 初始 value 都为 0，第二个应始终保持 0。",
      "不要把所有对象的状态误当成一个全局变量。本课没有 static 成员；普通数据成员属于各个实例。",
      "输入 n，只给第一个 Counter 累加 n，输出两个对象的 value。用不相同的状态检查对象是否真正独立。",
    ],
    task: "两个 Counter 初值均为 0，只对第一个调用 add(n)，输出两个 value（空格分隔）。",
    starter: program(
      "cpp",
      `${read("cpp")}\nstd::vector<Counter> counters(2);\ncounters[1].add(n);\nstd::cout << counters[0].value << " " << counters[1].value;`,
      "struct Counter { int value=0; void add(int n) { value+=n; } };",
    ),
    solution: program(
      "cpp",
      `${read("cpp")}\nstd::vector<Counter> counters(2);\ncounters[0].add(n);\nstd::cout << counters[0].value << " " << counters[1].value;`,
      "struct Counter { int value=0; void add(int n) { value+=n; } };",
    ),
    stdin: "4",
    tests: tests(["4", "4 0"], ["-2", "-2 0"], ["0", "0 0"]),
    quizzes: [
      q(
        "两个普通 Counter 对象的数据成员通常是？",
        ["各自独立", "自动共享同一整数", "不可修改"],
        0,
        "本课的非 static 成员分别属于每个实例。",
      ),
      q(
        "只给 counters[0] 加 4，第二个初值 0 会变成？",
        ["4", "0", "8"],
        1,
        "调用作用于第一个对象，第二个保持原状。",
      ),
    ],
    demo: demo(
      "同一种类，两个独立实例",
      'std::vector<Counter> counters(2);\ncounters[0].add(4);\nstd::cout << counters[0].value << " " << counters[1].value;',
      [
        1,
        "分别建立两个对象。",
        {},
        {
          links: [
            {
              from: "counters[0]",
              to: "对象 A",
              label: "独立实例",
              fields: { value: 0 },
            },
            {
              from: "counters[1]",
              to: "对象 B",
              label: "独立实例",
              fields: { value: 0 },
            },
          ],
        },
      ],
      [
        2,
        "只修改对象 A。",
        {},
        {
          links: [
            {
              from: "counters[0]",
              to: "对象 A",
              label: "add(4)",
              fields: { value: 4 },
            },
            {
              from: "counters[1]",
              to: "对象 B",
              label: "保持",
              fields: { value: 0 },
            },
          ],
        },
      ],
      [
        3,
        "两个读数不同，说明状态独立。",
        { "A.value": 4, "B.value": 0 },
        { output: "4 0" },
      ],
    ),
  },
);

// Python: containers, errors and explicit object state.
definitions.push(
  {
    language: "python",
    number: 9,
    order: 80,
    title: "字符串切片与不可变性",
    chapter: "文本与容器",
    concepts: ["str", "切片", "不可变"],
    reading: [
      "字符串是字符序列，可以用下标读取字符。切片 text[start:stop] 包含 start，不包含 stop；text[:2] 取前两个字符。",
      "字符串不可原地修改。text.upper() 等方法返回新的字符串，若需要保存变化，应把返回值赋给一个名字。",
      "本课输入至少两个英文字母，只需取前两位并输出，不要把它误写成 text[2]，后者只读取第三个字符。",
      "切片可以安全截取指定范围，但长度与单个下标仍不同。本课先理解范围边界，再在列表课程中比较切片复制。",
    ],
    task: "读入至少两个英文字母组成的单词，输出它的前两个字符。",
    starter: "text = input()\nprint(text[2:])\n",
    solution: "text = input()\nprint(text[:2])\n",
    stdin: "python",
    tests: tests(["python", "py"], ["code", "co"], ["hi", "hi"]),
    quizzes: [
      q(
        'text="python"，text[:2] 是？',
        ["py", "pyt", "thon"],
        0,
        "右边界 2 不包含在切片内。",
      ),
      q(
        'str 的字符可以通过 text[0]="A" 原地替换吗？',
        ["可以", "不可以", "只要长度不变就可以"],
        1,
        "字符串是不可变对象，需要创建新字符串。",
      ),
    ],
    demo: demo(
      "切片选择半开区间",
      'text = "python"\nprefix = text[:2]\nprint(prefix)',
      [
        1,
        "文本共有六个字符。",
        { text: "python" },
        { items: ["p", "y", "t", "h", "o", "n"] },
      ],
      [
        2,
        "选择下标 0、1，右边界 2 不包括。",
        { prefix: "py" },
        { items: ["p", "y"], active: 1 },
      ],
      [3, "输出截取后的新字符串。", { prefix: "py" }, { output: "py\n" }],
    ),
  },
  {
    language: "python",
    number: 10,
    order: 90,
    title: "元组与序列解包",
    chapter: "文本与容器",
    concepts: ["tuple", "解包", "交换变量"],
    reading: [
      "元组把多个值放在一起，例如 point=(2,3)。元组自身不能替换元素，适合表达固定结构的一组数据。",
      "x,y=point 会按顺序把两个元素绑定到两个名字。左边名字数量必须与待解包元素数量匹配。",
      "x,y=y,x 会先求右侧两个旧值，再一次性绑定左侧名字。连续写 x=y; y=x 则会丢失旧 x。",
      "读入两个整数，使用解包交换它们，然后输出交换后的两个值。不要用相同的新值覆盖两边。",
    ],
    task: "读入两个整数 x y，使用序列解包交换两个变量，再输出 x y。",
    starter: "x, y = map(int, input().split())\nx = y\ny = x\nprint(x, y)\n",
    solution: "x, y = map(int, input().split())\nx, y = y, x\nprint(x, y)\n",
    stdin: "2 7",
    tests: tests(["2 7", "7 2"], ["0 -3", "-3 0"], ["4 4", "4 4"]),
    quizzes: [
      q(
        "x,y=(2,7) 后，y 是？",
        ["2", "7", "(2,7)"],
        1,
        "按顺序解包，第二个值绑定到 y。",
      ),
      q(
        "交换 x=2,y=7，正确的结果是？",
        ["7 7", "2 2", "7 2"],
        2,
        "交换需要保留两个旧值，不能按覆盖顺序丢失它们。",
      ),
    ],
    demo: demo(
      "先读取两个旧值，再同时绑定",
      "x, y = 2, 7\nx, y = y, x\nprint(x, y)",
      [1, "两个名字绑定到不同整数。", { x: 2, y: 7 }],
      [2, "先求右侧为 (7,2)，再绑定 x、y。", { x: 7, y: 2, 右侧: "(7, 2)" }],
      [3, "输出交换后的顺序。", { x: 7, y: 2 }, { output: "7 2\n" }],
    ),
  },
  {
    language: "python",
    number: 11,
    order: 100,
    title: "字典与键值查找",
    chapter: "文本与容器",
    concepts: ["dict", "键值对", "get"],
    reading: [
      '字典把键关联到值，例如 {"apple":3,"pear":5}。读取 prices["apple"] 按键查找，不是按第几个位置查找。',
      "直接读取不存在的键会抛出 KeyError。prices.get(name,0) 可在缺失时返回默认值 0，不会自动插入该键。",
      "列表用整数下标选位置，字典用键表达含义。键区分大小写；本课只使用给定的小写英文水果名。",
      "读入水果名，查询 apple=3、pear=5、banana=2；不存在则输出 0。练习定义清楚缺失值的行为。",
    ],
    task: "查询水果价格：apple=3、pear=5、banana=2；输入其他名字时输出 0。",
    starter:
      'prices = {"apple":3, "pear":5, "banana":2}\nname = input()\nprint(prices.get("apple", 0))\n',
    solution:
      'prices = {"apple":3, "pear":5, "banana":2}\nname = input()\nprint(prices.get(name, 0))\n',
    stdin: "pear",
    tests: tests(
      ["pear", "5"],
      ["banana", "2"],
      ["apple", "3"],
      ["orange", "0"],
    ),
    quizzes: [
      q(
        "字典查找主要依靠什么？",
        ["键", "列表位置", "变量名字的长度"],
        0,
        "键与对应值关联，顺序不是本课查找依据。",
      ),
      q(
        'prices.get("orange",0) 在键缺失时返回？',
        ["异常", "0", "apple"],
        1,
        "get 的第二个参数指定默认返回值。",
      ),
    ],
    demo: demo(
      "键决定读取哪一个值",
      'prices = {"apple":3, "pear":5}\nname = "pear"\nprice = prices.get(name, 0)\nprint(price)',
      [1, "建立键到价格的对应关系。", { apple: 3, pear: 5 }],
      [2, "待查找的键是 pear。", { name: "pear" }],
      [3, "找到 pear 对应的 5。", { name: "pear", price: 5 }],
      [4, "输出查找结果。", { price: 5 }, { output: "5\n" }],
    ),
  },
  {
    language: "python",
    number: 12,
    order: 110,
    title: "集合与去重",
    chapter: "文本与容器",
    concepts: ["set", "唯一值", "len"],
    reading: [
      "集合保存互不重复的元素。set([2,2,4]) 得到包含 2 和 4 的集合，重复的 2 只保留一份。",
      "集合适合判断成员是否存在以及统计不同值，不应依赖它的打印顺序。若需要固定顺序输出，应另行排序。",
      "len(list) 统计列表全部项，len(set(list)) 统计不同元素的数量。这两个问题在有重复时答案不同。",
      "读取一行空格分隔的整数，输出不同数字的个数。输入至少一个整数，不需要输出集合本身。",
    ],
    task: "读入一行整数，输出其中不同数字的个数。",
    starter: "numbers = list(map(int, input().split()))\nprint(len(numbers))\n",
    solution:
      "numbers = list(map(int, input().split()))\nprint(len(set(numbers)))\n",
    stdin: "2 2 4",
    tests: tests(["2 2 4", "2"], ["1 1 1", "1"], ["0 -1 2", "3"]),
    quizzes: [
      q(
        "set([2,2,4]) 中有几个不同元素？",
        ["3", "2", "1"],
        1,
        "重复的 2 不会成为两个集合元素。",
      ),
      q(
        "集合输出的顺序应当用来表示原输入顺序吗？",
        ["应该", "不应该", "与列表完全相同"],
        1,
        "集合不用于保留输入顺序。",
      ),
    ],
    demo: demo(
      "重复值不会增加集合大小",
      "numbers = [2,2,4]\nunique = set(numbers)\nprint(len(unique))",
      [
        1,
        "列表保存全部三项，包括重复。",
        { 列表长度: 3 },
        { items: [2, 2, 4] },
      ],
      [
        2,
        "集合中只有两个不同整数；图中顺序仅为示意。",
        { 集合大小: 2 },
        { items: [2, 4] },
      ],
      [3, "输出不同值的数量。", { 集合大小: 2 }, { output: "2\n" }],
    ),
  },
  {
    language: "python",
    number: 13,
    order: 120,
    title: "列表推导式与筛选",
    chapter: "文本与容器",
    concepts: ["列表推导式", "过滤条件", "新列表"],
    reading: [
      "列表推导式用 [表达式 for 名字 in 序列 if 条件] 构造新列表。先逐项取值，再按条件筛选，最后计算表达式。",
      "[n*n for n in numbers if n>0] 只对正数求平方。条件的位置决定先筛选哪些输入，不是对平方结果再筛选。",
      "0 不是正数，条件要写 >0 而不是 >=0。原 numbers 不会因生成新列表而被原地替换。",
      "输入一行整数，求所有正数的平方和。没有正数时 sum([]) 为 0，不需要特殊制造一个元素。",
    ],
    task: "输入一行整数，使用列表推导式收集正数的平方，并输出它们的总和。",
    starter:
      "numbers = list(map(int, input().split()))\nsquares = [n*n for n in numbers]\nprint(sum(squares))\n",
    solution:
      "numbers = list(map(int, input().split()))\nsquares = [n*n for n in numbers if n > 0]\nprint(sum(squares))\n",
    stdin: "-2 3 4",
    tests: tests(["-2 3 4", "25"], ["-3 0", "0"], ["1 2", "5"]),
    quizzes: [
      q(
        "筛选 n>0 时，-2、0、3 中保留谁？",
        ["全部", "0 和 3", "只有 3"],
        2,
        "严格大于零只接受正数。",
      ),
      q(
        "输入 [-2,3]，正数平方列表是？",
        ["[4,9]", "[9]", "[3]"],
        1,
        "先过滤掉 -2，再计算 3*3。",
      ),
    ],
    demo: demo(
      "先筛选，再计算新元素",
      "numbers = [-2,3,4]\nsquares = [n*n for n in numbers if n>0]\nprint(sum(squares))",
      [1, "原列表保留全部输入。", {}, { items: [-2, 3, 4] }],
      [
        2,
        "-2 不满足条件，被跳过。",
        { n: -2, 条件: "False" },
        { items: [-2, 3, 4], active: 0 },
      ],
      [2, "3 满足条件，产生 9。", { n: 3, 新列表: "[9]" }, { items: [9] }],
      [
        2,
        "4 满足条件，追加 16。",
        { n: 4, 新列表: "[9,16]" },
        { items: [9, 16] },
      ],
      [3, "新列表求和为 25。", { total: 25 }, { output: "25\n" }],
    ),
  },
  {
    language: "python",
    number: 14,
    order: 130,
    title: "异常处理与输入校验",
    chapter: "函数与调试",
    concepts: ["try", "except", "ValueError"],
    reading: [
      '用户输入可能不符合预期。int("abc") 无法转换整数，会抛出 ValueError；应当明确处理这种可预期的输入错误。',
      "把可能失败的转换放进 try，在 except ValueError 中提供替代行为。转换成功时，不会执行该 except 分支。",
      "不要用 except: 隐藏所有异常。只捕获本课预期的 ValueError，其他程序错误应保留诊断信息。",
      "本课输入一个整数文本或无效文本：能转换就输出它加一，不能转换则输出 invalid。输入校验与业务计算分开观察。",
    ],
    task: "输入可转为整数时输出其值加 1；遇到 ValueError 时输出 invalid。",
    starter: "text = input()\nvalue = int(text)\nprint(value + 1)\n",
    solution:
      'text = input()\ntry:\n    value = int(text)\n    print(value + 1)\nexcept ValueError:\n    print("invalid")\n',
    stdin: "abc",
    tests: tests(
      ["abc", "invalid"],
      ["5", "6"],
      ["-1", "0"],
      ["3.5", "invalid"],
    ),
    quizzes: [
      q(
        'int("abc") 通常触发什么？',
        ["ValueError", "自动变成 0", "返回 abc"],
        0,
        "文本不符合整数格式，转换失败。",
      ),
      q(
        'int("5") 转换成功，会执行 except ValueError 吗？',
        ["会", "不会", "一定退出程序"],
        1,
        "except 只处理匹配的异常路径。",
      ),
    ],
    demo: demo(
      "失败路径转入对应的异常分支",
      'text = "abc"\ntry:\n    value = int(text)\nexcept ValueError:\n    print("invalid")',
      [1, "输入保留为原始文本。", { text: "abc" }],
      [
        3,
        "整数转换失败，不会产生 value 绑定。",
        { text: "abc", 异常: "ValueError" },
      ],
      [4, "转入匹配的处理分支。", { 异常: "ValueError" }],
      [5, "输出明确的输入错误提示。", { text: "abc" }, { output: "invalid\n" }],
    ),
  },
  {
    language: "python",
    number: 15,
    order: 140,
    title: "列表引用与浅拷贝",
    chapter: "对象与引用",
    concepts: ["对象引用", "别名", "copy"],
    reading: [
      "Python 的名字绑定到对象。b=a 不会复制列表，而是让两个名字引用同一个列表；经 b 修改元素也能从 a 看到。",
      "b=a.copy() 创建新的外层列表。本课元素都是不可变整数，所以修改 b[0] 不会修改 a[0]。",
      "浅拷贝并不会递归复制嵌套的可变对象。这个限制需要记住，但本课不讨论深拷贝实现，也不把 Python 引用称为可运算的 C 指针。",
      "读入 n，令 a=[n,2]。复制为 b 后，把 b 的首项增加 10，输出 a[0] 与 b[0]，检查两份外层列表独立。",
    ],
    task: "修复列表复制，使 b[0] 加 10 后 a[0] 保持原输入。输出 a[0] b[0]。",
    starter:
      "n = int(input())\na = [n, 2]\nb = a\nb[0] += 10\nprint(a[0], b[0])\n",
    solution:
      "n = int(input())\na = [n, 2]\nb = a.copy()\nb[0] += 10\nprint(a[0], b[0])\n",
    stdin: "3",
    tests: tests(["3", "3 13"], ["0", "0 10"], ["-2", "-2 8"]),
    quizzes: [
      q(
        "a=[1,2]; b=a; b[0]=9 后 a[0] 是？",
        ["1", "9", "2"],
        1,
        "两个名字指向同一个列表。",
      ),
      q(
        "本课整数列表使用 a.copy() 后修改 b[0]，a[0] 会怎样？",
        ["一起变化", "保持原值", "被删除"],
        1,
        "copy 创建新的外层列表，这里元素为不可变整数。",
      ),
    ],
    demo: demo(
      "创建新列表，避免共享修改",
      "a = [3,2]\nb = a.copy()\nb[0] += 10\nprint(a[0], b[0])",
      [
        1,
        "名字 a 绑定第一个列表。",
        {},
        {
          links: [
            {
              from: "a",
              to: "列表 A",
              label: "绑定",
              fields: { "[0]": 3, "[1]": 2 },
            },
          ],
        },
      ],
      [
        2,
        "copy 产生另一个列表对象。",
        {},
        {
          links: [
            {
              from: "a",
              to: "列表 A",
              label: "绑定",
              fields: { "[0]": 3, "[1]": 2 },
            },
            {
              from: "b",
              to: "列表 B",
              label: "复制后绑定",
              fields: { "[0]": 3, "[1]": 2 },
            },
          ],
        },
      ],
      [
        3,
        "只修改列表 B 的首项。",
        {},
        {
          links: [
            {
              from: "a",
              to: "列表 A",
              label: "保持",
              fields: { "[0]": 3, "[1]": 2 },
            },
            {
              from: "b",
              to: "列表 B",
              label: "更新",
              fields: { "[0]": 13, "[1]": 2 },
            },
          ],
        },
      ],
      [
        4,
        "两个列表读出不同值。",
        { "a[0]": 3, "b[0]": 13 },
        { output: "3 13\n" },
      ],
    ),
  },
  {
    language: "python",
    number: 16,
    order: 150,
    title: "类、实例与 self",
    chapter: "类与对象",
    concepts: ["class", "实例属性", "self"],
    reading: [
      "class 描述一种对象的属性和行为。counter=Counter() 创建实例；counter.value 是属于这个实例的数据。",
      "实例方法第一个参数通常写 self。调用 counter.add() 时，Python 会把 counter 作为 self 传入，方法通过 self.value 访问它的状态。",
      "方法里写 value=0 只创建局部名字，不会更新 self.value。这里不需要 global，应该明确修改当前实例的属性。",
      "补全 add 方法，让输入保存到 counter.value 后能在方法调用中加一。先学清 self，下一课再专门学习构造初始化。",
    ],
    task: "补全 Counter.add，使其给当前实例的 value 加一，输出更新后的 value。",
    starter:
      "class Counter:\n    def add(self):\n        value = 0\n        value += 1\n\ncounter = Counter()\ncounter.value = int(input())\ncounter.add()\nprint(counter.value)\n",
    solution:
      "class Counter:\n    def add(self):\n        self.value += 1\n\ncounter = Counter()\ncounter.value = int(input())\ncounter.add()\nprint(counter.value)\n",
    stdin: "5",
    tests: tests(["5", "6"], ["0", "1"], ["-1", "0"]),
    quizzes: [
      q(
        "实例方法中的 self 通常代表？",
        ["当前实例", "类名字符串", "所有全局变量"],
        0,
        "调用方法时，实例会传给第一个参数。",
      ),
      q(
        "想更新当前实例的 value，应该写？",
        ["value += 1", "self.value += 1", "class.value += 1"],
        1,
        "使用 self 明确访问实例属性。",
      ),
    ],
    demo: demo(
      "self 把方法连接到具体实例",
      "counter = Counter()\ncounter.value = 5\ncounter.add() # 方法体：self.value += 1\nprint(counter.value)",
      [1, "创建 Counter 实例。", { 类型: "Counter" }],
      [
        2,
        "为这个实例保存 value=5。",
        {},
        {
          links: [
            {
              from: "counter",
              to: "实例 A",
              label: "绑定",
              fields: { value: 5 },
            },
          ],
        },
      ],
      [
        3,
        "方法中的 self 指向本次调用的 counter。",
        {},
        {
          links: [
            {
              from: "self / counter",
              to: "实例 A",
              label: "更新属性",
              fields: { value: 6 },
            },
          ],
        },
      ],
      [4, "从实例属性读取新值。", { "counter.value": 6 }, { output: "6\n" }],
    ),
  },
  {
    language: "python",
    number: 17,
    order: 160,
    title: "__init__ 与实例初始化",
    chapter: "类与对象",
    concepts: ["__init__", "初始化", "实例属性"],
    reading: [
      "创建实例时，__init__ 负责初始化其状态。例如 Counter(7) 会把 7 传给 __init__ 的 start 参数。",
      "在 __init__ 内用 self.value=start，把初始值保存到当前实例。只写 value=start 会创建局部变量，方法结束后实例仍缺少该属性。",
      "__init__ 不应返回业务计算结果。它负责建立属性；读取属性和后续计算应由调用方或其他方法完成。",
      "修复初始化，确保 Counter(n).value 等于传入值。通过不同输入检查对象是否真正保存了参数，而不是总得到默认值。",
    ],
    task: "实现 __init__，让 Counter(n) 把 n 保存为实例属性 value。",
    starter:
      "class Counter:\n    def __init__(self, start):\n        self.value = 0\n\nn = int(input())\ncounter = Counter(n)\nprint(counter.value)\n",
    solution:
      "class Counter:\n    def __init__(self, start):\n        self.value = start\n\nn = int(input())\ncounter = Counter(n)\nprint(counter.value)\n",
    stdin: "7",
    tests: tests(["7", "7"], ["-3", "-3"], ["0", "0"]),
    quizzes: [
      q(
        "__init__ 主要用于？",
        ["初始化实例状态", "打印类源码", "删除所有实例"],
        0,
        "它在创建过程中设置初始属性。",
      ),
      q(
        "保存 start 到当前实例应写？",
        ["value = start", "self.value = start", "return start"],
        1,
        "self.value 是实例属性，普通 value 只是局部名字。",
      ),
    ],
    demo: demo(
      "把传入值保存为实例属性",
      "class Counter:\n    def __init__(self, start):\n        self.value = start\ncounter = Counter(7)\nprint(counter.value)",
      [4, "创建 Counter，向初始化方法传入 7。", { start: 7 }],
      [
        3,
        "self.value 保存本次传入值。",
        {},
        {
          links: [
            {
              from: "self / counter",
              to: "实例 A",
              label: "初始化属性",
              fields: { value: 7 },
            },
          ],
        },
      ],
      [
        5,
        "初始化完成后可以读取实例属性。",
        { "counter.value": 7 },
        { output: "7\n" },
      ],
    ),
  },
  {
    language: "python",
    number: 18,
    order: 170,
    title: "实例方法与独立状态",
    chapter: "类与对象",
    concepts: ["实例方法", "多个实例", "属性更新"],
    reading: [
      "同一个类可以创建多个实例，它们的普通实例属性相互独立。a=Counter(0) 和 b=Counter(0) 是两次创建。",
      "a.add(n) 中 self 绑定 a，所以只修改 a.value。b.value 保持原值，除非单独对 b 调用方法或修改属性。",
      "不要把类属性误当每个对象自己的可变容器。本课在 __init__ 中为每个对象创建 value，不使用共享的可变类属性。",
      "补全 add 方法，让第一个计数器累加输入，第二个保持 0。输出两者，直观检查方法究竟作用于哪个对象。",
    ],
    task: "补全 add(amount)，对 a 加输入 n，b 保持 0；输出 a.value b.value。",
    starter:
      "class Counter:\n    def __init__(self):\n        self.value = 0\n    def add(self, amount):\n        amount += 1\n\na = Counter()\nb = Counter()\na.add(int(input()))\nprint(a.value, b.value)\n",
    solution:
      "class Counter:\n    def __init__(self):\n        self.value = 0\n    def add(self, amount):\n        self.value += amount\n\na = Counter()\nb = Counter()\na.add(int(input()))\nprint(a.value, b.value)\n",
    stdin: "4",
    tests: tests(["4", "4 0"], ["-2", "-2 0"], ["0", "0 0"]),
    quizzes: [
      q(
        "a 与 b 分别创建，调用 a.add(4) 时 self 是？",
        ["a", "b", "类名 Counter"],
        0,
        "接收这次方法调用的对象就是 self。",
      ),
      q(
        "a 初值 0，加 4；b 初值 0 没有修改，输出？",
        ["4 4", "4 0", "0 4"],
        1,
        "不同实例的普通实例属性彼此独立。",
      ),
    ],
    demo: demo(
      "方法调用只改变接收它的实例",
      "a = Counter()\nb = Counter()\na.add(4)\nprint(a.value, b.value)",
      [
        1,
        "创建第一个实例。",
        {},
        {
          links: [
            { from: "a", to: "实例 A", label: "绑定", fields: { value: 0 } },
          ],
        },
      ],
      [
        2,
        "第二次创建得到独立实例。",
        {},
        {
          links: [
            { from: "a", to: "实例 A", label: "绑定", fields: { value: 0 } },
            { from: "b", to: "实例 B", label: "绑定", fields: { value: 0 } },
          ],
        },
      ],
      [
        3,
        "self 指向 a，只更新实例 A。",
        {},
        {
          links: [
            {
              from: "a / self",
              to: "实例 A",
              label: "add(4)",
              fields: { value: 4 },
            },
            { from: "b", to: "实例 B", label: "保持", fields: { value: 0 } },
          ],
        },
      ],
      [
        4,
        "两个实例分别保有自己的状态。",
        { "a.value": 4, "b.value": 0 },
        { output: "4 0\n" },
      ],
    ),
  },
);

export const courseExtensions = definitions.map((d) => {
  const sharedTopics: Record<string, string> = {
    算术运算与表达式: "arithmetic",
    "while 循环与终止条件": "while",
    字符串与结束符: "string",
    "string 与文本处理": "string",
    字符串切片与不可变性: "string",
    "指针：取址与解引用": "pointer",
    指针与对象地址: "pointer",
    结构体与成员访问: "struct",
    "struct 与成员函数": "struct",
    "class 与对象状态": "class",
    "类、实例与 self": "class",
    构造函数与初始化: "constructor",
    "__init__ 与实例初始化": "constructor",
    对象数组与独立状态: "instances",
    实例方法与独立状态: "instances",
  };
  const correction = d.solution
    .split("\n")
    .find((line, i) => line !== d.starter.split("\n")[i]);
  const lesson: Lesson = {
    id: `${d.language}-${d.number}`,
    language: d.language,
    index: d.number - 1,
    order: d.order,
    topic: sharedTopics[d.title] ?? `${d.language}:${d.number}`,
    title: d.title,
    subtitle: `${d.concepts.join("、")}的基本用法。`,
    minutes: d.number >= 13 ? 22 : 16,
    concepts: d.concepts,
    explanation: d.reading.slice(0, 2),
    task: d.task,
    starter: d.starter,
    solution: d.solution,
    stdin: d.stdin,
    expected: d.tests[0].expected,
    tests: d.tests,
    hints: [
      `先确认本课要练习的${d.concepts.join("、")}，对照输入和实际输出。`,
      d.reading[2],
      `关键写法：${correction?.trim()}。修改后用不同输入重新验证。`,
    ],
  };
  const prerequisites =
    d.order <= 30
      ? ["先理解变量、整数输入和输出"]
      : d.order <= 90
        ? ["先理解变量、分支、循环与下标"]
        : d.chapter === "类与对象"
          ? ["先理解函数、变量与成员访问"]
          : ["先理解数组、函数与参数传递"];
  const plan = {
    version: "intro-v3",
    chapter: d.chapter,
    goals: [
      `理解${d.concepts[0]}`,
      `解释${d.concepts[1]}的作用`,
      "用不同输入验证本课任务",
    ],
    prerequisites,
    sections: d.reading.map((text, i) => ({
      title: ["核心概念", "跟着例子理解", "常见误区", "本课练习"][i],
      text,
    })),
    questions: d.quizzes.map((item, i) => ({
      id: (i === 0 ? "prediction" : "review") as Question["id"],
      ...item,
    })),
    visualTitle: d.demo.title,
    takeaway: d.reading[0],
  };
  return { lesson, plan, demo: d.demo };
});
export const extensionFor = (id: string) =>
  courseExtensions.find((item) => item.lesson.id === id);
