import type { Lesson, Language } from "../shared/curriculum.ts";
import type { Retest } from "../shared/flow.ts";
type AuditedRetest = Retest & {
  correct: number;
  explanation: string;
  language: Language;
  expected: string;
};
const wrap = (language: Language, body: string, declarations = "") =>
  language === "python"
    ? body
    : `${language === "c" ? "#include <stdio.h>" : "#include <iostream>\n#include <vector>\n#include <string>"}\n${declarations}\nint main() {\n${body}\nreturn 0;\n}`;
const out = (l: Language, value: string) =>
  l === "python"
    ? `print(${value})`
    : l === "c"
      ? `printf("%d\\n", ${value});`
      : `std::cout << ${value} << '\\n';`;
function item(
  language: Language,
  id: string,
  title: string,
  code: string,
  expected: string,
  distractors: string[],
  explanation: string,
): AuditedRetest {
  const options = [
    ...new Set([...distractors.slice(0, 1), expected, ...distractors.slice(1)]),
  ];
  return {
    id: `${language}-${id}-v1`,
    language,
    title,
    prompt: "先不运行，判断这段新程序的输出。",
    code,
    options,
    correct: options.indexOf(expected),
    expected,
    explanation,
  };
}
export const retestBank: AuditedRetest[] = (
  ["c", "cpp", "python"] as const
).flatMap((l) => {
  const py = l === "python";
  return [
    item(
      l,
      "assignment",
      "赋值后的值",
      wrap(
        l,
        py
          ? "a = 3\nb = a\na = 8\nprint(b)"
          : `int a=3; int b=a; a=8; ${out(l, "b")}`,
      ),
      "3",
      ["8", "11"],
      "b 保存赋值当时的整数值；之后重新给 a 赋值不会改变 b。",
    ),
    item(
      l,
      "condition",
      "边界条件迁移",
      wrap(
        l,
        py
          ? "n = 18\nif n > 18:\n    print(1)\nelse:\n    print(0)"
          : `int n=18; if(n>18) { ${out(l, "1")} } else { ${out(l, "0")} }`,
      ),
      "0",
      ["1", "18"],
      "18 > 18 为假，所以进入 else 分支。请区分 > 和 >=。",
    ),
    item(
      l,
      "loop",
      "循环上界迁移",
      wrap(
        l,
        py
          ? "total = 0\nfor i in range(2, 5):\n    total += i\nprint(total)"
          : `int total=0; for(int i=2;i<5;i++) { total+=i; } ${out(l, "total")}`,
      ),
      "9",
      ["14", "5"],
      "循环体处理 2、3、4，和为 9；上界 5 未进入循环体。",
    ),
    item(
      l,
      "while",
      "终止条件迁移",
      wrap(
        l,
        py
          ? "n = 3\nwhile n > 0:\n    n -= 1\nprint(n)"
          : `int n=3; while(n>0) { n--; } ${out(l, "n")}`,
      ),
      "0",
      ["1", "-1"],
      "n 依次变为 2、1、0，下一次条件不成立，最终输出 0。",
    ),
    item(
      l,
      "sequence",
      "下标与元素迁移",
      wrap(
        l,
        py
          ? "values = [2, 7, 4]\nvalues[1] += 3\nprint(values[1])"
          : `int values[]={2,7,4}; values[1]+=3; ${out(l, "values[1]")}`,
      ),
      "10",
      ["5", "7"],
      "下标 1 指向第二个元素 7；该元素加 3 后为 10。",
    ),
    item(
      l,
      "function",
      "参数与返回值迁移",
      wrap(
        l,
        py
          ? "def add(n):\n    return n + 2\nx = 3\ny = add(x)\nprint(y)"
          : `int x=3; int y=add(x); ${out(l, "y")}`,
        py ? "" : "int add(int n) { return n+2; }",
      ),
      "5",
      ["3", "2"],
      "实参 3 传给形参 n，返回 3+2；返回值保存到 y，所以输出 5。",
    ),
  ];
});
for (const l of ["c", "cpp"] as const) {
  retestBank.push(
    item(
      l,
      "pointer",
      "指针修改原对象",
      wrap(l, `int x=4; int *p=&x; *p+=3; ${out(l, "x")}`),
      "7",
      ["4", "3"],
      "p 指向 x，*p += 3 修改的是 x 本身，所以 x 为 7。",
    ),
  );
  retestBank.push(
    item(
      l,
      "struct",
      "成员独立变化",
      wrap(
        l,
        `struct Point p={2,5}; p.x+=3; ${out(l, "p.x+p.y")}`,
        "struct Point { int x; int y; };",
      ),
      "10",
      ["7", "13"],
      "x 从 2 变为 5，y 仍为 5；两个成员的和为 10。",
    ),
  );
}
retestBank.push(
  item(
    "cpp",
    "class",
    "两个实例独立变化",
    wrap(
      "cpp",
      "Counter a; Counter b; a.add(); a.add(); std::cout << a.value << ' ' << b.value << '\\n';",
      "class Counter { public: int value=0; void add() { value++; } };",
    ),
    "2 0",
    ["2 2", "1 0"],
    "a 和 b 是两个独立实例；两次 add() 都作用于 a，b 保持初值。",
  ),
);
retestBank.push(
  item(
    "python",
    "class",
    "两个实例独立变化",
    "class Counter:\n    def __init__(self):\n        self.value = 0\n    def add(self):\n        self.value += 1\na = Counter()\nb = Counter()\na.add()\na.add()\nprint(a.value, b.value)",
    "2 0",
    ["2 2", "1 0"],
    "a、b 的实例属性分别保存；两次调用的接收者都是 a，b.value 仍为 0。",
  ),
);
retestBank.push(
  item(
    "python",
    "dictionary",
    "不存在的键",
    "prices = {'apple': 3, 'pear': 5}\nprint(prices.get('banana', 0))",
    "0",
    ["2", "报错"],
    "get 的第二个参数是键不存在时的默认值；这里返回 0。",
  ),
);
retestBank.push(
  item(
    "python",
    "copy",
    "独立列表的修改",
    "a = [4, 8]\nb = a.copy()\nb[0] = 9\nprint(a[0], b[0])",
    "4 9",
    ["9 9", "4 4"],
    "这里复制出独立列表；修改 b 的第一个整数元素不改变 a。",
  ),
);
retestBank.push(
  item(
    "python",
    "exception",
    "无效输入的处理",
    "try:\n    n = int('oops')\n    print(n + 1)\nexcept ValueError:\n    print('invalid')",
    "invalid",
    ["1", "oops"],
    "int 转换失败产生 ValueError，进入对应 except 分支。",
  ),
);
retestBank.push(
  item(
    "python",
    "set",
    "重复元素与集合",
    "values = [1, 1, 3, 3, 5]\nprint(len(set(values)))",
    "3",
    ["5", "2"],
    "集合去除重复后有 1、3、5，共三个不同元素。",
  ),
);
for (const l of ["c", "cpp", "python"] as const) {
  retestBank.push(
    item(
      l,
      "arithmetic",
      "整除与余数",
      wrap(
        l,
        l === "python"
          ? "print(7 // 2, 7 % 2)"
          : l === "c"
            ? 'printf("%d %d\\n", 7/2, 7%2);'
            : "std::cout << 7/2 << ' ' << 7%2 << '\\n';",
      ),
      "3 1",
      ["3.5 1", "3 0"],
      "7 除以 2 的整数商是 3，余数是 1；Python 这里使用 //。",
    ),
  );
}
retestBank.push(
  item(
    "c",
    "character",
    "字符范围判断",
    wrap("c", "char ch='7'; printf(\"%d\\n\", ch>='0' && ch<='9');"),
    "1",
    ["7", "0"],
    "字符 '7' 落在字符 '0' 到 '9' 的范围内，逻辑表达式为真，输出 1。",
  ),
);
retestBank.push(
  item(
    "c",
    "string",
    "结束符不计入长度",
    wrap(
      "c",
      'char text[]="code"; int n=0; while(text[n]!=\'\\0\') n++; printf("%d\\n",n);',
    ),
    "4",
    ["5", "3"],
    "四个可见字符后是结束符；循环在结束符处停止，所以长度是 4。",
  ),
);
retestBank.push(
  item(
    "cpp",
    "string",
    "string 的字符数",
    wrap(
      "cpp",
      "std::string text=\"code\"; std::cout << text.size() << '\\n';",
    ),
    "4",
    ["5", "3"],
    "size() 返回字符串中的字符数，code 有四个字符。",
  ),
);
retestBank.push(
  item(
    "python",
    "string",
    "切片的起止位置",
    "text = 'robot'\nprint(text[1:3])",
    "ob",
    ["obo", "ro"],
    "切片包含下标 1、2 的字符，排除上界 3，所以得到 ob。",
  ),
);
retestBank.push(
  item(
    "c",
    "matrix",
    "二维下标与对角线",
    wrap("c", 'int a[2][2]={{1,2},{3,4}}; printf("%d\\n",a[0][0]+a[1][1]);'),
    "5",
    ["4", "6"],
    "左上角为 1，右下角为 4；两个行列下标都要对应正确。",
  ),
);
retestBank.push(
  item(
    "c",
    "valuepass",
    "形参副本的修改",
    wrap(
      "c",
      'int x=3; add(x); printf("%d\\n",x);',
      "void add(int n) { n++; }",
    ),
    "3",
    ["4", "0"],
    "普通整数参数接收值的副本；没有返回并保存新值，也没有通过指针修改原对象，所以 x 仍为 3。",
  ),
);
retestBank.push(
  item(
    "cpp",
    "reference",
    "引用参数修改调用方",
    wrap(
      "cpp",
      "int x=3; add(x); std::cout << x << '\\n';",
      "void add(int &n) { n++; }",
    ),
    "4",
    ["3", "0"],
    "n 是 x 的引用；函数内的 n++ 修改调用方的 x。",
  ),
);
for (const l of ["c", "cpp"] as const) {
  retestBank.push(
    item(
      l,
      "pointerarray",
      "指针偏移读取元素",
      wrap(l, `int a[]={2,7,4}; int *p=a; ${out(l, "*(p+1)")}`),
      "7",
      ["2", "4"],
      "p 指向首元素，p+1 指向第二个元素，解引用读出 7。",
    ),
  );
}
retestBank.push(
  item(
    "c",
    "structpointer",
    "通过结构体指针修改成员",
    wrap(
      "c",
      'struct Point point={2,3}; struct Point *p=&point; p->x+=2; printf("%d\\n",point.x);',
      "struct Point { int x; int y; };",
    ),
    "4",
    ["2", "5"],
    "p 指向 point，箭头访问的 x 是原结构体成员，所以从 2 增至 4。",
  ),
);
retestBank.push(
  item(
    "c",
    "structarray",
    "遍历多个结构体",
    wrap(
      "c",
      'struct Student a[]={{7},{9},{5}}; int total=0; for(int i=0;i<3;i++) total+=a[i].score; printf("%d\\n",total);',
      "struct Student { int score; };",
    ),
    "21",
    ["16", "5"],
    "三次循环分别累加 7、9、5，总和为 21。",
  ),
);
retestBank.push(
  item(
    "cpp",
    "vector",
    "追加后遍历容器",
    wrap(
      "cpp",
      "std::vector<int> values={2,4}; values.push_back(3); int total=0; for(int n:values) total+=n; std::cout << total << '\\n';",
    ),
    "9",
    ["6", "3"],
    "push_back 把 3 加在末尾，遍历包含 2、4、3 三个元素。",
  ),
);
retestBank.push(
  item(
    "cpp",
    "member",
    "成员函数读取当前对象",
    wrap(
      "cpp",
      "Point p{2,5}; std::cout << p.sum() << '\\n';",
      "struct Point { int x; int y; int sum() { return x+y; } };",
    ),
    "7",
    ["2", "5"],
    "p.sum() 读取 p 的 x 和 y，返回 2+5。",
  ),
);
retestBank.push(
  item(
    "python",
    "tuple",
    "解包交换变量",
    "a, b = 2, 7\na, b = b, a\nprint(a, b)",
    "7 2",
    ["7 7", "2 7"],
    "右侧先取得原来的 b 和 a，再分别赋给左侧的 a、b。",
  ),
);
retestBank.push(
  item(
    "python",
    "comprehension",
    "先筛选再计算",
    "values = [-1, 2, 3]\nsquares = [n*n for n in values if n > 0]\nprint(sum(squares))",
    "13",
    ["14", "5"],
    "负数 -1 被过滤，保留 2 和 3 的平方 4、9，再求和为 13。",
  ),
);
retestBank.push(
  item(
    "cpp",
    "constructor",
    "构造时保存初值",
    wrap(
      "cpp",
      "Counter a(7); std::cout << a.value << '\\n';",
      "class Counter { public: int value; Counter(int n):value(n) {} };",
    ),
    "7",
    ["0", "1"],
    "构造函数的初始化列表把传入的 7 保存到实例成员 value。",
  ),
);
retestBank.push(
  item(
    "python",
    "constructor",
    "初始化实例属性",
    "class Counter:\n    def __init__(self, n):\n        self.value = n\na = Counter(7)\nprint(a.value)",
    "7",
    ["0", "1"],
    "创建实例时调用 __init__，self.value 保存传入的 7。",
  ),
);
retestBank.push(
  item(
    "cpp",
    "encapsulation",
    "拒绝无效状态修改",
    wrap(
      "cpp",
      "Account a; a.deposit(-3); std::cout << a.get() << '\\n';",
      "class Account { int balance=10; public: void deposit(int n) { if(n>0) balance+=n; } int get() { return balance; } };",
    ),
    "10",
    ["7", "13"],
    "deposit 的条件不接受负金额，因此余额保持 10。",
  ),
);
retestBank.push(
  item(
    "cpp",
    "composition",
    "更新组合对象中的字段",
    wrap(
      "cpp",
      "Player p; p.move(3); std::cout << p.position.x << ' ' << p.position.y << '\\n';",
      "struct Point { int x=0; int y=0; }; class Player { public: Point position; void move(int dx) { position.x+=dx; } };",
    ),
    "3 0",
    ["3 3", "0 0"],
    "move 修改内部 position 的 x，y 没有被修改，仍为 0。",
  ),
);
for (const language of ["c", "cpp", "python"] as const) {
  const variant = item(
    language,
    "loop",
    "换一个起点核对循环边界",
    wrap(
      language,
      language === "python"
        ? "total = 0\nfor i in range(3, 6):\n    total += i\nprint(total)"
        : `int total=0; for(int i=3;i<6;i++) total+=i; ${out(language, "total")}`,
    ),
    "12",
    ["9", "18"],
    "本题处理3、4、5，和为12；上界6不进入循环体。它与此前从2到4的题目不同。",
  );
  variant.id = `${language}-loop-v2`;
  retestBank.push(variant);
}
export function retestsFor(lesson: Lesson) {
  // Output-only entry lessons have not introduced assignment yet. Use their
  // reviewed course question instead of testing an unrelated prerequisite.
  if (lesson.index === 0) return [];
  const text = [lesson.title, ...lesson.concepts].join(" ");
  const category = /算术|整数除法|优先级/.test(text)
    ? "arithmetic"
    : /字符与字符编码/.test(text)
      ? "character"
      : /字符串|string|切片/.test(text)
        ? "string"
        : /二维/.test(text)
          ? "matrix"
          : /作用域与值传递/.test(text)
            ? "valuepass"
            : /引用与参数/.test(text)
              ? "reference"
              : /指针与数组/.test(text)
                ? "pointerarray"
                : /结构体指针/.test(text)
                  ? "structpointer"
                  : /结构体数组/.test(text)
                    ? "structarray"
                    : /vector/.test(text)
                      ? "vector"
                      : /struct 与成员函数/.test(text)
                        ? "member"
                        : /元组/.test(text)
                          ? "tuple"
                          : /推导式/.test(text)
                            ? "comprehension"
                            : /浅拷贝|列表引用/.test(text)
                              ? "copy"
                              : /字典/.test(text)
                                ? "dictionary"
                                : /异常/.test(text)
                                  ? "exception"
                                  : /集合/.test(text)
                                    ? "set"
                                    : /构造函数|__init__/.test(lesson.title)
                                      ? "constructor"
                                      : /封装/.test(text)
                                        ? "encapsulation"
                                        : /对象组合/.test(text)
                                          ? "composition"
                                          : /类|class|实例|对象/.test(text) &&
                                              lesson.language !== "c"
                                            ? "class"
                                            : /结构体|struct/.test(text)
                                              ? "struct"
                                              : /指针|引用/.test(text)
                                                ? "pointer"
                                                : /while/.test(text)
                                                  ? "while"
                                                  : /循环/.test(text)
                                                    ? "loop"
                                                    : /函数|作用域/.test(text)
                                                      ? "function"
                                                      : /条件|分支/.test(text)
                                                        ? "condition"
                                                        : /数组|列表|下标/.test(
                                                              text,
                                                            )
                                                          ? "sequence"
                                                          : "assignment";
  const sameLanguage = retestBank.filter((r) => r.language === lesson.language);
  const matches = sameLanguage.filter((r) =>
    r.id.startsWith(`${lesson.language}-${category}-v`),
  );
  return matches.length
    ? matches
    : sameLanguage.filter((r) => r.id === `${lesson.language}-assignment-v1`);
}
export const publicRetest = ({
  correct: _c,
  explanation: _e,
  language: _l,
  expected: _x,
  ...rest
}: AuditedRetest): Retest => rest;
