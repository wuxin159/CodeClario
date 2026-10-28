import type { Lesson } from "./curriculum.ts";
import { visualLesson } from "./visualLessons.ts";
export type ErrorExperiment = {
  id: string;
  title: string;
  why: string;
  question: string;
  before: string;
  after: string;
  stdin: string;
};
export function errorExperiment(lesson: Lesson): ErrorExperiment {
  const py = lesson.language === "python",
    cpp = lesson.language === "cpp";
  const wrap = (body: string, extra = "") =>
    py
      ? extra + body
      : cpp
        ? "#include <iostream>\n#include <vector>\n#include <string>\nusing namespace std;\n" +
          extra +
          "int main() {\n" +
          body +
          "\nreturn 0;\n}\n"
        : "#include <stdio.h>\n#include <string.h>\n" +
          extra +
          "int main(void) {\n" +
          body +
          "\nreturn 0;\n}\n";
  const print = (s: string) =>
    py
      ? "print(" + s + ")\n"
      : cpp
        ? "cout << " + s + " << endl;"
        : 'printf("%d\\n", ' + s + ");";
  let before = "",
    after = "",
    title = "",
    why = "",
    question = "";
  const kind = visualLesson(lesson).kind;
  if (kind === "output") {
    title = "文字为什么不能少一对引号";
    why = "程序需要分清一段文字和代码中的名字。";
    question = "错误出现在哪个符号附近？引号帮助程序区分了什么？";
    before = wrap(
      py
        ? "print(Hello!)\n"
        : cpp
          ? "cout << Hello! << endl;"
          : "printf(Hello!);",
    );
    after = wrap(
      py
        ? 'print("Hello!")\n'
        : cpp
          ? 'cout << "Hello!" << endl;'
          : 'printf("Hello!\\n");',
    );
  } else if (kind === "division") {
    title = "为什么除法没有出现小数";
    why = "整数参与的除法与带小数的除法可能产生不同结果。";
    question = "先看两个操作数的类型，再比较两次运行的结果。";
    before = wrap(
      py
        ? "a = 7\nb = 2\nresult = a // b\nprint(result)\n"
        : "int a = 7;\nint b = 2;\ndouble result = a / b;\n" +
            (cpp ? "cout << result << endl;" : 'printf("%.1f\\n", result);'),
    );
    after = py
      ? before.replace("a // b", "a / b")
      : before.replace("a / b", "(double)a / b");
  } else if (kind === "branch") {
    title = "边界上的18被分到哪里";
    why = "只差一个等号，恰好位于边界的输入就会走另一条路。";
    question = "18等于边界时，两个版本实际选择了哪个分支？";
    before = wrap(
      py
        ? 'age = 18\nif age > 18:\n    print("adult")\nelse:\n    print("minor")\n'
        : "int age = 18;\nif (age > 18) {\n" +
            (cpp ? 'cout << "adult" << endl;' : 'printf("adult\\n");') +
            "\n} else {\n" +
            (cpp ? 'cout << "minor" << endl;' : 'printf("minor\\n");') +
            "\n}",
    );
    after = before.replace("age > 18", "age >= 18");
  } else if (kind === "loop") {
    title = "循环为什么少加了一个数";
    why = "循环边界决定真正进入计算的数，不能只看想加到几。";
    question = "最后一个5进入过循环体吗？改变边界后再观察。";
    before = wrap(
      py
        ? "total = 0\nfor i in range(1, 5):\n    total += i\nprint(total)\n"
        : "int total = 0;\nfor (int i = 1; i < 5; i++) {\n total += i;\n}\n" +
            print("total"),
    );
    after = py
      ? before.replace("range(1, 5)", "range(1, 6)")
      : before.replace("i < 5", "i <= 5");
  } else if (kind === "array" || kind === "append" || lesson.id === "c-18") {
    title = "数据存在，为什么没有参与求和";
    why = "存了三个元素，不代表循环真的访问了三个元素。";
    question = "沿实际访问路径找出没有参与计算的那一项。";
    before = wrap(
      py
        ? "numbers = [2, 4, 6]\ntotal = 0\nfor n in numbers[:2]:\n    total += n\nprint(total)\n"
        : (cpp
            ? "vector<int> numbers{2, 4, 6};"
            : "int numbers[] = {2, 4, 6};") +
            "\nint total = 0;\nfor (int i = 0; i < 2; i++) {\n total += numbers[i];\n}\n" +
            print("total"),
    );
    after = py
      ? before.replace("numbers[:2]", "numbers")
      : before.replace("i < 2", "i < 3");
  } else if (
    kind === "call" ||
    kind === "scope" ||
    lesson.id === "cpp-11" ||
    lesson.id === "c-15"
  ) {
    title = "函数改了值，外面的变量为什么没变";
    why = "传入一个数、返回一个数和直接修改原对象是不同的事情。";
    question = "比较函数里的值和调用方的值：改动到底发生在哪里？";
    if (py) {
      before = "def add_one(x):\n    x += 1\n\na = 3\nadd_one(a)\nprint(a)\n";
      after =
        "def add_one(x):\n    return x + 1\n\na = 3\na = add_one(a)\nprint(a)\n";
    } else if (lesson.id === "cpp-11") {
      before = wrap(
        "int a = 3;\nadd_one(a);\n" + print("a"),
        "void add_one(int x) {\n x += 1;\n}\n",
      );
      after = before.replace("int x", "int &x");
    } else if (lesson.id === "c-15") {
      before = wrap(
        "int a = 3;\nadd_one(&a);\n" + print("a"),
        "void add_one(int *p) {\n int copy = *p;\n copy += 1;\n}\n",
      );
      after = before.replace("int copy = *p;\n copy += 1;", "*p += 1;");
    } else {
      before = wrap(
        "int a = 3;\nadd_one(a);\n" + print("a"),
        "void add_one(int x) {\n x += 1;\n}\n",
      );
      after = wrap(
        "int a = 3;\na = add_one(a);\n" + print("a"),
        "int add_one(int x) {\n return x + 1;\n}\n",
      );
    }
  } else if (kind === "pointer" || kind === "offset") {
    title =
      kind === "offset"
        ? "移动两个位置，还是读取第二个元素"
        : "改指针指向，还是改原对象";
    why = "指针保存的位置关系和对象里的数值需要分别观察。";
    question = "先看箭头指到谁，再看沿箭头读写的是哪个对象。";
    before =
      kind === "offset"
        ? wrap(
            "int values[] = {2, 4, 6};\nint *p = values;\n" + print("*(p + 1)"),
          )
        : wrap(
            "int a = 3;\nint b = 5;\nint *p = &a;\np = &b;\n*p = 7;\n" +
              print("a") +
              "\n" +
              print("b"),
          );
    after =
      kind === "offset"
        ? before.replace("p + 1", "p + 2")
        : before.replace("p = &b;", "// 保持指向 a");
  } else if (kind === "cstring") {
    title = "两个字母为什么占三个位置";
    why = "字符串的结束标记占空间，但不算进文字长度。";
    question = "图中的结束符和两个字母分别占了什么位置？";
    before = wrap('char text[] = "Hi";\nprintf("%zu\\n", sizeof(text));');
    after = before.replace("sizeof(text)", "strlen(text)");
  } else if (kind === "character") {
    title = "字符7为什么不是整数7";
    why = "字符记号和它表示的数值不是同一个东西。";
    question = "先看打印的对象是字符编码还是换算后的整数。";
    before = wrap("int value = '7';\n" + print("value"));
    after = before.replace("'7'", "'7' - '0'");
  } else if (kind === "matrix") {
    title = "行和列写反会访问到谁";
    why = "两个下标的顺序决定访问的格子。";
    question = "先找行，再找列，两个版本指向同一个格子吗？";
    before = wrap("int grid[2][2] = {{1, 2}, {3, 8}};\n" + print("grid[0][1]"));
    after = before.replace("grid[0][1]", "grid[1][0]");
  } else if (kind === "slice") {
    title = "切片边界为什么和想的不一样";
    why = cpp
      ? "C++的substr第二个参数表示长度，不能当作结束下标。"
      : "Python切片不包含右边界。";
    question = "把每个字符的下标标出来，再对比两次得到的文本。";
    before = wrap(
      py
        ? 'text = "abcd"\nprint(text[1:3])\n'
        : 'string text = "abcd";\ncout << text.substr(1, 3) << endl;',
    );
    after = py
      ? before.replace("[1:3]", "[1:4]")
      : before.replace("substr(1, 3)", "substr(1, 2)");
  } else if (kind === "unpack") {
    title = "交换为什么把两个值变成一样";
    why = "先后赋值时，第二次读取的可能已不是原来的值。";
    question = "第一行改完后，原值还保留在哪里？";
    before = "a, b = 1, 2\na = b\nb = a\nprint(a, b)\n";
    after = "a, b = 1, 2\na, b = b, a\nprint(a, b)\n";
  } else if (kind === "dictionary") {
    title = "get得到的值改了，字典为什么没变";
    why = "修改取出的整数，不等于给字典中的键重新赋值。";
    question = "你改的是临时变量，还是这个键对应的值？";
    before =
      'scores = {"Ada": 3}\nvalue = scores.get("Ada", 0)\nvalue += 1\nprint(scores["Ada"])\n';
    after = 'scores = {"Ada": 3}\nscores["Ada"] += 1\nprint(scores["Ada"])\n';
  } else if (kind === "set") {
    title = "输入三项为什么只剩两项";
    why = "集合保存不同的值，重复项不会增加元素数量。";
    question = "如果想保留全部输入，应该选择哪种容器？";
    before = "values = {1, 1, 2}\nprint(len(values))\n";
    after = "values = [1, 1, 2]\nprint(len(values))\n";
  } else if (kind === "filter") {
    title = "负数为什么没有进入结果";
    why = "筛选发生在计算之前，不满足条件的元素会被跳过。";
    question = "被跳过的是哪一个输入，改变条件后它会参与吗？";
    before =
      "numbers = [-2, 3, 4]\nsquares = [n*n for n in numbers if n > 0]\nprint(squares)\n";
    after = before.replace(" if n > 0", "");
  } else if (kind === "exception") {
    title = "带小数的文字为什么不能直接转成整数";
    why = "转换函数对输入格式有要求，失败后赋值不会完成。";
    question = "错误发生在转换还是打印？改成允许小数的转换再试。";
    before = 'text = "3.5"\nvalue = int(text)\nprint(value)\n';
    after = before.replace("int(text)", "float(text)");
  } else if (kind === "copy") {
    title = "改了b，为什么a也跟着变";
    why = "两个名字可能指向同一个列表。";
    question = "先看两个名字是否共用对象，再建立副本比较。";
    before = "a = [1, 2]\nb = a\nb[0] = 9\nprint(a)\nprint(b)\n";
    after = before.replace("b = a", "b = a.copy()");
  } else if (kind === "encapsulation") {
    title = "调用了方法，内部值为什么没变";
    why = "受控入口会先检查参数，不满足条件时不修改成员。";
    question = "这个参数通过了检查吗？换一个允许的参数再观察。";
    before = wrap(
      "Counter a;\na.add(-1);\n" + print("a.get()"),
      "class Counter {\n int value = 3;\npublic:\n void add(int n) {\n  if (n > 0) value += n;\n }\n int get() { return value; }\n};\n",
    );
    after = before.replace("a.add(-1)", "a.add(1)");
  } else if (kind === "composition") {
    title = "修改取出的副本，为什么内部对象没变";
    why = "访问内部成员和复制一个值出来再修改，效果不同。";
    question = "这次赋值真正改动的是哪个格子？";
    before = wrap(
      "Player p{{1}};\nint copy = p.position.x;\ncopy = 7;\n" +
        print("p.position.x"),
      "struct Position { int x; };\nstruct Player { Position position; };\n",
    );
    after = before.replace("copy = 7;", "p.position.x = 7;");
  } else if (["record", "constructor", "instances"].includes(kind)) {
    title = "改了一个对象，另一个为什么没变";
    why = "每个实例保存自己的状态，操作和输出都要选对对象。";
    question = "本次改的是a还是b？最后打印的又是谁？";
    if (py) {
      before =
        "class Box:\n    def __init__(self, value):\n        self.value = value\n\na = Box(3)\nb = Box(3)\na.value += 1\nprint(b.value)\n";
      after = before.replace("print(b.value)", "print(a.value)");
    } else {
      before = wrap(
        (cpp
          ? "Box a{3};\nBox b{3};"
          : "struct Box a = {3};\nstruct Box b = {3};") +
          "\na.value += 1;\n" +
          print("b.value"),
        cpp ? "struct Box { int value; };\n" : "struct Box { int value; };\n",
      );
      after = before.replace(print("b.value"), print("a.value"));
    }
  } else {
    title = "改了a，为什么b没有跟着变";
    why = "给整数赋值时，先读取右侧当时的值，之后的赋值是另一次操作。";
    question = "b拿到值以后，后面哪一行真的重新给b赋过值？";
    before = wrap(
      py
        ? "a = 3\nb = a\na = 8\nprint(b)\n"
        : "int a = 3;\nint b = a;\na = 8;\n" + print("b"),
    );
    after = before.replace(print("b"), print("a"));
  }
  if (lesson.topic === "while") {
    title = "while为什么少做了一轮";
    why = "while先判断，再执行循环体；更新变量后才进入下一次判断。";
    question = "先看最后一次判断时的i，再看循环体是否还会执行。";
    before = wrap(
      py
        ? "i = 1\ntotal = 0\nwhile i < 5:\n    total += i\n    i += 1\nprint(total)\n"
        : "int i = 1;\nint total = 0;\nwhile (i < 5) {\n total += i;\n i++;\n}\n" +
            print("total"),
    );
    after = before.replace("i < 5", "i <= 5");
  }
  if (kind === "constructor") {
    title = "创建时传了参数，成员为什么还是0";
    why = "构造参数是传进来的值，必须把它交给这个对象的成员。";
    question = "构造过程改的是参数自己，还是对象里的成员？";
    if (cpp) {
      before = wrap(
        "Counter a(3);\n" + print("a.value"),
        "class Counter {\npublic:\n int value = 0;\n Counter(int value) {\n  value = value;\n }\n};\n",
      );
      after = before
        .replace("Counter(int value)", "Counter(int start)")
        .replace("value = value;", "value = start;");
    } else if (py) {
      before =
        "class Counter:\n    def __init__(self, value):\n        self.value = 0\n        value = value\n\na = Counter(3)\nprint(a.value)\n";
      after = before.replace(
        "        value = value",
        "        self.value = value",
      );
    }
  }
  return {
    id: "error-v1:" + lesson.id,
    title,
    why,
    question,
    before,
    after,
    stdin: "",
  };
}
