import type { Lesson } from "./curriculum.ts";
import { extensionFor } from "./courseExtensions.ts";

export type Question = {
  id: "prediction" | "review";
  prompt: string;
  options: string[];
  correct: number;
  explanation: string;
};
export type StudyRecord = {
  visited?: boolean;
  prediction?: { answer: number; correct: boolean };
  review?: { answer: number; correct: boolean };
  hints?: number;
};
export type StudyEvent = {
  lessonId: string;
  kind: "visited" | "prediction" | "review" | "hint";
  answer?: number;
  level?: number;
};
export type LessonStudy = ReturnType<typeof teachingPlan>;

const chapters = [
  "认识程序",
  "数据与表达式",
  "选择与边界",
  "重复与累加",
  "组织多个值",
  "函数与调试",
];
const goals = [
  ["按顺序读懂程序", "区分源码与输出", "理解字符串与换行"],
  ["区分赋值和相等判断", "跟踪变量先后两次取值", "先计算右侧，再更新左侧"],
  ["把文字条件写成比较表达式", "判断实际执行的分支", "用边界值检验条件"],
  ["确定循环包含哪些数", "跟踪每轮的累加值", "解释结束时为何不再执行"],
  ["区分下标与元素", "跟踪遍历的范围", "检查是否遗漏最后一个元素"],
  ["区分参数和返回值", "跟踪调用与局部变量", "用多个参数检查函数"],
];
const readings = [
  [
    {
      title: "先读执行顺序",
      text: "程序按执行顺序处理语句，不是把所有代码同时执行。先找到负责输出的语句，再观察屏幕上增加了什么。注释用于解释代码，本身不会变成输出。",
    },
    {
      title: "文字与换行",
      text: "引号界定字符串，引号本身通常不会打印。换行决定下一次输出从哪里开始。大小写、空格和标点也是结果的一部分。",
    },
    {
      title: "一次小修改",
      text: "先运行初始程序，再只改变输出内容。若编译失败，先检查引号是否成对；若输出不同，逐字符对照任务要求。",
    },
  ],
  [
    {
      title: "名字让数据可重复使用",
      text: "变量名让后面的代码能够访问数据。初始化给出第一次取值，之后的赋值可以更新它。输出一个变量时，读取的是执行到这里的当前值。",
    },
    {
      title: "右侧先计算",
      text: "answer = answer + 1 的含义是读取原值，加一，再把结果赋给 answer。它不是数学中的等式。改变了一个值，不会让已经输出的文字自动变化。",
    },
    {
      title: "类型与表达式",
      text: "整数、带小数的数值和字符串是不同的数据。加减乘除构成表达式；括号可以明确计算顺序。本课先用小整数，避免溢出与精度问题。",
    },
  ],
  [
    {
      title: "先读入，再比较",
      text: "本题先从标准输入读一个整数 age。输入框里的文字必须被读入程序才会参与运算。预填20只是一次输入，不代表其他输入也正确。",
    },
    {
      title: "比较与分支",
      text: "比较表达式决定条件真假。> 不含相等，>= 包含相等；条件成立进入 if，不成立进入 else。一次判断只走其中一条路径。",
    },
    {
      title: "把边界单独拿出来",
      text: "题目说18岁及以上，所以17、18、20分别检查边界下方、边界本身与上方。不要只调到预填输入通过；应从规则推出条件。",
    },
  ],
  [
    {
      title: "分清两种变量",
      text: "计数变量表示本轮处理的数，累加变量保留前面几轮的结果。total += i 表示把本轮的 i 加到原有 total，而不是覆盖成 i。",
    },
    {
      title: "从第一轮走到结束",
      text: "每轮都要判断是否继续。先列出实际处理的数，再依次更新总和；最后一次不满足条件时，不执行循环体。",
    },
    {
      title: "如何找出少算的一项",
      text: "如果得到10，先检查实际处理了1、2、3、4还是包含5。把程序拆成每轮状态，比直接猜测最终答案更容易发现边界错误。",
    },
  ],
  [
    {
      title: "位置不等于数值",
      text: "在2、4、6组成的序列中，第一个位置的下标为0，值为2。下标用于找到元素，元素的数值才参与这里的求和。",
    },
    {
      title: "长度与有效范围",
      text: "三个元素的非负下标是0、1、2。遍历要覆盖所有目标元素；少访问一个位置会遗漏一项，访问不属于集合的位置则是另一种错误。",
    },
    {
      title: "一次只观察一个访问",
      text: "记录本轮取出的元素以及 total 前后的值。先观察2使总和变为2，再观察4使总和变为6，最后6使总和变为12。",
    },
  ],
  [
    {
      title: "输入通过参数进入函数",
      text: "调用 square(5) 时，5是实参。函数内部通过形参 n 使用这个输入。局部变量属于本次调用；下一次调用有自己的参数。",
    },
    {
      title: "返回结果，再继续调用处",
      text: "return 把计算结果交回调用处，并结束这次函数执行。返回和打印是不同的动作：调用处可以使用、保存或输出返回的值。",
    },
    {
      title: "检查规律，不只检查一个数",
      text: "平方是 n*n，而不是固定25。应尝试3、0和负数；若不同输入都只返回25，说明函数没有实现题目中的规律。",
    },
  ],
];
const languageDetails = {
  c: [
    "C从main进入；printf负责输出，\\n表示换行，return 0表示程序正常结束。语句末尾需要分号，字符串使用英文双引号。",
    "int answer = 0 声明并初始化一个整型对象；answer = 42更新其值。printf的%d与int对应；比较相等应使用==。",
    'scanf("%d", &age)将读到的整数写入age，&age提供存储位置。本课使用合法整数输入；格式和转换失败会在后续专门练习。',
    "C的for依次执行初始化、判断、循环体、更新，再回到判断。i<5只包含1到4，i<=5才包含5。",
    "C数组元素具有同一类型。本题numbers[i]读取下标i的值，i<3覆盖0、1、2。越界属于未定义行为，不能把偶然读到的数当作合法结果。",
    "int square(int n)声明参数和返回类型。这里按值传递，n是本次调用的参数；返回表达式应使用n，而不是只处理输入5。",
  ],
  cpp: [
    "C++从main进入；std::cout输出文本，std::endl在本例中产生换行。<<把右侧的值送入输出流，语句末尾需要分号。",
    "int指定本课变量的类型；std::cout << answer读取当前值。初始化和后续赋值是不同时间的操作；=与==不能混用。",
    "std::cin >> age把标准输入中的整数读入age。花括号组织分支内的语句；>=的含义和变量当前取值共同决定路径。",
    "C++本题使用三段式for：int i=1、i<=5、i++。先判断再进入循环体；更新在循环体之后，本课无需模板或泛型知识。",
    "当前示例使用内建数组，三个元素的有效下标为0到2；容器vector与string会在后续语言专属课程介绍。",
    "当前square函数接收int并返回int，按值传参。先理解一次调用的输入输出，再学习引用与其他参数形式。",
  ],
  python: [
    "Python按顶层语句顺序执行；print默认在结尾换行。#之后是注释。缩进表达代码层次，第一节先保持顶层语句不缩进。",
    "Python赋值将名字绑定到对象，不需要写int声明。answer=42不是创建一个固定大小的C整型盒子；==才是相等比较。",
    "input()取得一行文本，int(input())把合法整数文本转换成整数。冒号与缩进标识分支，不能用花括号替代。",
    "Python的for从可迭代对象逐项取值。range(1,5)不含终点5；range(1,6)依次给出1到5。这里没有隐藏的i++语句。",
    "numbers[:2]产生包含前两项的切片，因此原示例没有遍历第三项。for number in numbers直接取得元素，不会自动创建名为i的下标变量。",
    "def定义函数，缩进决定函数体。return n*n把值交给调用处，print(square(5))再输出返回值。没有return时不能当成已经返回平方。",
  ],
};
const prediction: Omit<Question, "id">[] = [
  {
    prompt: "课程示例依次输出“Hello!”和“world”，每次都换行。结果是什么？",
    options: [
      "Hello!world（同一行）",
      "Hello! 与 world 分别占一行",
      "只输出 world",
    ],
    correct: 1,
    explanation: "两次输出按顺序追加，换行让第二次从新行开始。",
  },
  {
    prompt: "课程示例先令answer为0，再赋值42，最后输出。输出是多少？",
    options: ["0", "42", "0 和 42 都输出"],
    correct: 1,
    explanation: "最后读取的是更新后的值；赋值本身不等于输出。",
  },
  {
    prompt: "初始程序的条件是age > 20，输入18会输出什么？",
    options: ["adult", "minor", "没有输出"],
    correct: 1,
    explanation:
      "18 > 20为假，因此原程序进入else，输出minor。它不符合题目要求。",
  },
  {
    prompt: "初始程序只处理1、2、3、4。total从0开始，最终是多少？",
    options: ["10", "15", "4"],
    correct: 0,
    explanation: "0+1+2+3+4=10。修正范围后才会把5也加入。",
  },
  {
    prompt: "初始程序只处理序列[2,4,6]的前两项。结果是多少？",
    options: ["12", "6", "2"],
    correct: 1,
    explanation: "处理2和4后总和为6，第三项6被遗漏，尚未发生越界。",
  },
  {
    prompt: "原函数直接return n，调用square(5)得到什么？",
    options: ["25", "5", "0"],
    correct: 1,
    explanation: "原函数返回原参数5；函数名不会自动让它执行平方。",
  },
];
const reviews: Omit<Question, "id">[] = [
  {
    prompt: "只改变第一条输出的文字，第二条语句也需要跟着改变吗？",
    options: [
      "一定会一起改变",
      "不会；它们是两条独立的输出语句",
      "程序不能有两条输出",
    ],
    correct: 1,
    explanation: "修改字符串影响对应语句，后面的输出语句保持自己的内容。",
  },
  {
    prompt: "answer先为7，再执行answer = answer + 1。新值是多少？",
    options: ["7", "1", "8"],
    correct: 2,
    explanation: "先读原值7，计算7+1，再把8赋给answer。",
  },
  {
    prompt: "题目要求18及以上为adult。输入恰好18应该走哪条分支？",
    options: ["adult分支", "minor分支", "两条都执行"],
    correct: 0,
    explanation: "大于等于包含相等情况，所以18属于adult。",
  },
  {
    prompt: "换个范围：从1累加到3，包含3。总和是多少？",
    options: ["3", "6", "10"],
    correct: 1,
    explanation: "1+2+3=6。先确认包含哪些数，再做累加。",
  },
  {
    prompt: "换成[1,3,5,7]，处理全部元素。最后非负下标与总和是什么？",
    options: ["下标4，总和16", "下标3，总和9", "下标3，总和16"],
    correct: 2,
    explanation: "四项的下标是0、1、2、3，总和为16。长度与最后下标相差1。",
  },
  {
    prompt: "修正后的square(n)返回n*n。调用square(-3)返回什么？",
    options: ["-9", "9", "25"],
    correct: 1,
    explanation: "(-3)*(-3)=9；函数根据传入参数计算，不固定返回25。",
  },
];

export function teachingPlan(lesson: Lesson) {
  const extended = extensionFor(lesson.id);
  if (extended) return extended.plan;
  return {
    version: "intro-v3",
    chapter: chapters[lesson.index],
    goals: goals[lesson.index],
    prerequisites: [
      ["无需编程基础"],
      ["先会输出文本"],
      ["先理解变量与整数输入"],
      ["先理解变量、比较和赋值"],
      ["先理解循环的范围"],
      ["先理解变量与输出"],
    ][lesson.index],
    sections: [
      ...readings[lesson.index],
      {
        title: `${lesson.language === "python" ? "Python" : lesson.language === "cpp" ? "C++" : "C"}中的写法`,
        text: languageDetails[lesson.language][lesson.index],
      },
    ],
    questions: [
      { id: "prediction" as const, ...prediction[lesson.index] },
      { id: "review" as const, ...reviews[lesson.index] },
    ],
    visualTitle: [
      "语句与输出",
      "变量的前后值",
      "输入与分支",
      "每一轮的变化",
      "访问与累加",
      "参数与返回",
    ][lesson.index],
    takeaway: goals[lesson.index].join("；"),
  };
}

export function studyStatus(record?: StudyRecord) {
  if (record?.review?.correct) return "理解检查通过";
  if (record?.review && !record.review.correct) return "建议复习";
  return record?.visited ? "已浏览 · 待复核" : "尚未学习";
}
