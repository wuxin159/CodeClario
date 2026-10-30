import { courseExtensions } from "./courseExtensions.ts";
export type Language = "c" | "cpp" | "python";
export type Lesson = {
  id: string;
  language: Language;
  index: number;
  order?: number;
  topic?: string;
  tests?: { input: string; expected: string }[];
  title: string;
  subtitle: string;
  minutes: number;
  concepts: string[];
  explanation: string[];
  task: string;
  starter: string;
  solution: string;
  expected: string;
  stdin: string;
  hints: string[];
};

export const languages = [
  {
    id: "c" as const,
    name: "C 语言",
    mark: "C",
    tag: "数组 · 指针 · 结构体",
    description: "从基本语法到指针、结构体，逐步理解数据与内存。",
    color: "blue",
    level: "入门",
  },
  {
    id: "cpp" as const,
    name: "C++",
    mark: "C⁺⁺",
    tag: "容器 · 引用 · 类与对象",
    description: "学习基础语法与常用容器，理解引用、类和对象。",
    color: "purple",
    level: "入门",
  },
  {
    id: "python" as const,
    name: "Python",
    mark: "Py",
    tag: "容器 · 异常 · 类与对象",
    description: "练习文本与容器处理，学习异常、对象引用和类。",
    color: "amber",
    level: "入门",
  },
];

const topics = [
  {
    title: "第一个程序",
    subtitle: "认识程序结构，练习输出文本。",
    concepts: ["程序结构", "输出", "字符串"],
    task: "修改程序，让它准确输出 Hello, world!，注意大小写和标点。",
    expected: "Hello, world!",
    hints: [
      "先找到负责输出文字的那一行。",
      "双引号里的文字会成为输出，试着修改它。",
      "把 Hello! 改成 Hello, world!，然后重新运行。",
    ],
    explanation: [
      "程序是一组交给计算机执行的指令。我们先从最直观的事情开始：在屏幕上输出一句话。",
      "字符串是一段被引号包围的文字。修改字符串里的内容，再运行程序，观察输出如何变化。",
    ],
  },
  {
    title: "变量与赋值",
    subtitle: "声明变量，读取并修改变量的值。",
    concepts: ["变量", "整数", "赋值"],
    task: "将变量 answer 的值设为 42，并输出它。",
    expected: "42",
    hints: [
      "观察变量 answer 现在存储的数字。",
      "赋值会把等号右边的值放进左边的变量。",
      "把 answer 的初始值从 0 改为 42。",
    ],
    explanation: [
      "变量让程序能够保存和使用数据。你可以把它想象成贴了标签的盒子，通过名字找到里面的值。",
      "赋值符号 = 表示存储，不是数学里的相等判断。变量的类型和使用方式随语言有所不同。",
    ],
  },
  {
    title: "条件判断",
    subtitle: "根据条件执行不同的代码。",
    concepts: ["条件判断", "比较", "分支"],
    task: "从输入读取一个整数。如果它大于等于 18，输出 adult，否则输出 minor。预填输入是 20。",
    expected: "adult",
    hints: [
      "先看输入的 age 是多少，再检查分支条件。",
      "题目要求「大于等于」，而不是仅仅「大于」。",
      "将判断中的 age > 20 改成 age >= 18。",
    ],
    explanation: [
      "条件判断让程序根据数据选择不同的路径。条件成立时执行一个分支，不成立时执行另一个。",
      "留意边界值：18 和 17 应进入不同的分支。测试边界，是发现逻辑错误的好方法。",
    ],
  },
  {
    title: "for 循环",
    subtitle: "设置循环范围，练习计数与累加。",
    concepts: ["循环", "累加", "边界"],
    task: "计算 1 + 2 + 3 + 4 + 5，并只输出总和 15。",
    expected: "15",
    hints: [
      "观察循环最后一次会处理哪个数。",
      "现在的循环遗漏了数字 5。",
      "让循环包含 5；C/C++ 可以使用 i <= 5，Python 可以使用 range(1, 6)。",
    ],
    explanation: [
      "循环能重复执行一段指令。计数变量控制循环的进度，累加变量保存每一步的结果。",
      "循环的起点、终点和步长都很重要。逐步观察每一轮的值，可以帮助理解边界条件。",
    ],
  },
  {
    title: "数组与列表",
    subtitle: "通过下标访问元素，并遍历集合。",
    concepts: ["数组 / 列表", "下标", "遍历"],
    task: "将集合中的 2、4、6 全部相加，输出 12。完成后可以打开右侧的数组概念实验。",
    expected: "12",
    hints: [
      "集合里有三个元素，检查循环实际访问了几个。",
      "下标从 0 开始：三个元素的下标是 0、1、2。",
      "C/C++ 遍历条件应为 i < 3；Python 可直接遍历整个列表。",
    ],
    explanation: [
      "数组或列表把多个值组织在一起。下标描述一个值的位置，首个位置通常从 0 开始计数。",
      "长度为 3 时，合法下标为 0、1、2。概念实验展示固定示例的遍历过程，帮助你建立直觉。",
    ],
  },
  {
    title: "函数与返回值",
    subtitle: "使用参数和返回值组织代码。",
    concepts: ["函数", "参数", "返回值"],
    task: "补全 square(n)，对传入整数返回它的平方。程序输出 square(5) 的结果25；检查还会调用其他参数。",
    expected: "25",
    hints: [
      "函数接收 n，应该返回 n 的平方。",
      "平方表示一个数乘以它自己。",
      "将函数的返回表达式改为 n * n。",
    ],
    explanation: [
      "函数把一段有意义的操作封装起来。参数是输入，返回值是结果，函数名表达它的用途。",
      "让每个函数只完成一件清楚的事，代码会更容易理解、测试和复用。",
    ],
  },
];

const code = {
  c: [
    [
      '#include <stdio.h>\n\nint main(void) {\n    printf("Hello!\\n");\n    return 0;\n}\n',
      '#include <stdio.h>\n\nint main(void) {\n    printf("Hello, world!\\n");\n    return 0;\n}\n',
    ],
    [
      '#include <stdio.h>\n\nint main(void) {\n    int answer = 0;\n    printf("%d\\n", answer);\n    return 0;\n}\n',
      '#include <stdio.h>\n\nint main(void) {\n    int answer = 42;\n    printf("%d\\n", answer);\n    return 0;\n}\n',
    ],
    [
      '#include <stdio.h>\n\nint main(void) {\n    int age;\n    scanf("%d", &age);\n    if (age > 20) {\n        printf("adult\\n");\n    } else {\n        printf("minor\\n");\n    }\n    return 0;\n}\n',
      '#include <stdio.h>\n\nint main(void) {\n    int age;\n    scanf("%d", &age);\n    if (age >= 18) printf("adult\\n");\n    else printf("minor\\n");\n    return 0;\n}\n',
    ],
    [
      '#include <stdio.h>\n\nint main(void) {\n    int total = 0;\n    for (int i = 1; i < 5; i++) {\n        total += i;\n    }\n    printf("%d\\n", total);\n    return 0;\n}\n',
      '#include <stdio.h>\n\nint main(void) {\n    int total = 0;\n    for (int i = 1; i <= 5; i++) total += i;\n    printf("%d\\n", total);\n    return 0;\n}\n',
    ],
    [
      '#include <stdio.h>\n\nint main(void) {\n    int numbers[] = {2, 4, 6};\n    int total = 0;\n    for (int i = 0; i < 2; i++) {\n        total += numbers[i];\n    }\n    printf("%d\\n", total);\n    return 0;\n}\n',
      '#include <stdio.h>\n\nint main(void) {\n    int numbers[] = {2, 4, 6};\n    int total = 0;\n    for (int i = 0; i < 3; i++) total += numbers[i];\n    printf("%d\\n", total);\n    return 0;\n}\n',
    ],
    [
      '#include <stdio.h>\n\nint square(int n) {\n    return n;\n}\n\nint main(void) {\n    printf("%d\\n", square(5));\n    return 0;\n}\n',
      '#include <stdio.h>\n\nint square(int n) {\n    return n * n;\n}\n\nint main(void) {\n    printf("%d\\n", square(5));\n    return 0;\n}\n',
    ],
  ],
  cpp: [
    [
      '#include <iostream>\n\nint main() {\n    std::cout << "Hello!" << std::endl;\n    return 0;\n}\n',
      '#include <iostream>\n\nint main() {\n    std::cout << "Hello, world!" << std::endl;\n    return 0;\n}\n',
    ],
    [
      "#include <iostream>\n\nint main() {\n    int answer = 0;\n    std::cout << answer << std::endl;\n    return 0;\n}\n",
      "#include <iostream>\n\nint main() {\n    int answer = 42;\n    std::cout << answer << std::endl;\n    return 0;\n}\n",
    ],
    [
      '#include <iostream>\n\nint main() {\n    int age;\n    std::cin >> age;\n    if (age > 20) std::cout << "adult";\n    else std::cout << "minor";\n    return 0;\n}\n',
      '#include <iostream>\n\nint main() {\n    int age;\n    std::cin >> age;\n    if (age >= 18) std::cout << "adult";\n    else std::cout << "minor";\n    return 0;\n}\n',
    ],
    [
      "#include <iostream>\n\nint main() {\n    int total = 0;\n    for (int i = 1; i < 5; i++) {\n        total += i;\n    }\n    std::cout << total << std::endl;\n    return 0;\n}\n",
      "#include <iostream>\n\nint main() {\n    int total = 0;\n    for (int i = 1; i <= 5; i++) total += i;\n    std::cout << total << std::endl;\n    return 0;\n}\n",
    ],
    [
      "#include <iostream>\n\nint main() {\n    int numbers[] = {2, 4, 6};\n    int total = 0;\n    for (int i = 0; i < 2; i++) {\n        total += numbers[i];\n    }\n    std::cout << total << std::endl;\n    return 0;\n}\n",
      "#include <iostream>\n\nint main() {\n    int numbers[] = {2, 4, 6};\n    int total = 0;\n    for (int i = 0; i < 3; i++) total += numbers[i];\n    std::cout << total << std::endl;\n    return 0;\n}\n",
    ],
    [
      "#include <iostream>\n\nint square(int n) {\n    return n;\n}\n\nint main() {\n    std::cout << square(5) << std::endl;\n    return 0;\n}\n",
      "#include <iostream>\n\nint square(int n) {\n    return n * n;\n}\n\nint main() {\n    std::cout << square(5) << std::endl;\n    return 0;\n}\n",
    ],
  ],
  python: [
    [
      '# 从这里开始，写下你的第一行代码\nprint("Hello!")\n',
      'print("Hello, world!")\n',
    ],
    [
      "# 给数据起一个名字\nanswer = 0\nprint(answer)\n",
      "answer = 42\nprint(answer)\n",
    ],
    [
      'age = int(input())\n\nif age > 20:\n    print("adult")\nelse:\n    print("minor")\n',
      'age = int(input())\n\nif age >= 18:\n    print("adult")\nelse:\n    print("minor")\n',
    ],
    [
      "total = 0\n\nfor i in range(1, 5):\n    total += i\n\nprint(total)\n",
      "total = 0\n\nfor i in range(1, 6):\n    total += i\n\nprint(total)\n",
    ],
    [
      "numbers = [2, 4, 6]\ntotal = 0\n\nfor number in numbers[:2]:\n    total += number\n\nprint(total)\n",
      "numbers = [2, 4, 6]\ntotal = 0\n\nfor number in numbers:\n    total += number\n\nprint(total)\n",
    ],
    [
      "def square(n):\n    return n\n\nprint(square(5))\n",
      "def square(n):\n    return n * n\n\nprint(square(5))\n",
    ],
  ],
};

const languageNotes: Record<Language, string[]> = {
  c: [
    "C 使用 printf 输出字符串，\\n 表示换行；main 的 return 0 表示程序正常结束。",
    "C 的整数变量可以声明为 int answer = 42；printf 中的 %d 用于输出 int。",
    'scanf("%d", &age) 把整数读入 age。>= 包含相等情况，> 不包含相等情况。',
    "for (int i = 1; i < 5; i++) 依次取 1、2、3、4，共四个值。条件改为 i <= 5 才包含 5。",
    "C 中长度为 3 的数组有效下标是 0、1、2。越界属于未定义行为，不能把某次读到的值当作正确结果。",
    "int square(int n) 接收整数 n；return n * n 返回它的平方。",
  ],
  cpp: [
    "C++ 可以使用 std::cout 输出，std::endl 输出换行。",
    "int answer = 42 声明并初始化一个整数，std::cout << answer 输出变量的值。",
    "std::cin >> age 从标准输入读取整数。>= 包含相等情况，> 不包含相等情况。",
    "for (int i = 1; i < 5; i++) 的 i 依次为 1、2、3、4。i <= 5 才会处理数字 5。",
    "C++ 原生数组长度为 3 时合法下标是 0、1、2。越界读取不是一个确定可靠的结果。",
    "函数接收参数，通过 return 返回结果；n * n 表示 n 的平方。",
  ],
  python: [
    'print("文字") 输出括号中的字符串，默认在末尾换行。',
    "Python 可以用 answer = 42 保存整数，不需要写 int 声明。",
    "input() 返回字符串，int(input()) 把输入转换为整数。if/else 的代码块通过缩进区分。",
    "range(start, stop) 包含 start、不包含 stop。range(1, 5) 产生 1、2、3、4，只有四个数；range(1, 6) 才产生 1 到 5。",
    "Python 列表下标从 0 开始；长度为 3 时最后的非负下标是 2。numbers[:2] 只取前两个元素。",
    "def 定义函数，return 返回值；n * n 表示 n 的平方。",
  ],
};

const foundationLessons: Lesson[] = languages.flatMap((language) =>
  // 旧课程 ID 保持稳定，展示顺序由 order 决定，防止扩课后历史学习记录关联到别的知识点。
  topics.map((topic, index) => ({
    ...topic,
    explanation: [...topic.explanation, languageNotes[language.id][index]],
    id: `${language.id}-${index + 1}`,
    language: language.id,
    index,
    order: [10, 20, 40, 50, 70, 105][index],
    topic: ["output", "variable", "condition", "for", "array", "function"][
      index
    ],
    minutes: [8, 12, 15, 15, 18, 16][index],
    stdin: index === 2 ? "20" : "",
    starter: code[language.id][index][0],
    solution: code[language.id][index][1],
  })),
);

export const lessons: Lesson[] = languages.flatMap((language) =>
  [...foundationLessons, ...courseExtensions.map((item) => item.lesson)]
    .filter((lesson) => lesson.language === language.id)
    .sort((a, b) => (a.order ?? a.index) - (b.order ?? b.index)),
);
export const coursePosition = (lesson: Lesson) =>
  lessons
    .filter((item) => item.language === lesson.language)
    .findIndex((item) => item.id === lesson.id);
export const equivalentLesson = (lesson: Lesson, language: Language) =>
  lessons.find(
    (item) => item.language === language && item.topic === lesson.topic,
  );

export const findLesson = (id: string) =>
  lessons.find((lesson) => lesson.id === id);

export type RunResult = {
  // 运行快照以 revision 绑定源码和输入；可选中断字段兼容数据库中已有的历史 JSON。
  trace?: import("./flow").ExecutionTrace;
  id: string;
  revision: string;
  lessonId: string;
  status: string;
  stdout: string;
  stderr: string;
  compileOutput: string;
  exitCode: number;
  durationMs: number;
  timedOut?: boolean;
  failure?: { phase: "compile" | "run"; kind: "timeout" | "terminated"; signal?: number };
  passed: boolean;
  tests: { input: string; expected: string; actual: string; passed: boolean }[];
};
