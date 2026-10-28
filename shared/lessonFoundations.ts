import type { Lesson } from "./curriculum.ts";
import { visualLesson, type VisualKind } from "./visualLessons.ts";

// Short authored primers: input to the AI, and an honestly labelled fallback
// when no model is connected. These teach meanings, not just prerequisite names.
const primers: Record<VisualKind, string> = {
  output:
    "程序按语句顺序执行。输出语句把内容写到屏幕，引号表示文字本身，换行决定下一段文字出现的位置。",
  assignment:
    "变量让你给数据取名字。赋值先计算右边，再把结果交给左边；程序里的等号表示赋值，不是数学里的相等判断。",
  division:
    "表达式会算出一个值。整数整除表示能分成多少个完整组，取余表示分完以后还剩多少；本课用秒与分钟来理解。",
  branch:
    "条件表达式得到真或假。if根据这个结果选择一条路径；没有选中的分支不会执行，不是把两个分支都运行一遍。",
  loop: "循环把一段操作重复执行。循环变量负责推进到下一轮，累加变量保留前面的结果；每一轮都需要知道什么时候继续、什么时候停止。",
  array:
    "数组或列表按顺序保存多个元素。下标从0开始；访问一个元素和处理全部元素不同，真正的遍历范围由代码决定。",
  call: "函数给一段操作命名。调用时把实参交给形参，return把一个结果交回调用位置；return本身不是屏幕输出。",
  character:
    "字符表示一个文字记号，单引号里的7是字符，不是整数7。字符可以比较；逻辑与要求两个比较条件同时成立。",
  cstring:
    "C字符串用字符数组保存文字，以结束符\\0标明结束位置。结束符占存储空间，但不算进strlen得到的文字长度。",
  matrix:
    "二维数组按行、列组织。grid[r][c]先选第r行，再选第c列；两个下标都从0开始。",
  scope:
    "不同函数里的变量可以是不同的对象。值传递会把数值复制给形参；修改形参不会自动写回调用方，需要使用返回值或地址关系。",
  pointer:
    "变量保存值，取址符&取得对象的地址。指针保存这个地址关系，*p沿着指针访问对象；p与*p的含义不同。",
  offset:
    "数组的元素依次排列。指针加2按元素类型移动两个位置，再用*读取到达的元素；指针的移动和被读取的值是两个概念。",
  record:
    "结构体或类定义一种对象的结构。创建实例后，它才拥有自己的成员；成员名用于选择对象内部的一个具体数据。",
  instances:
    "类是创建对象的模板。两次创建会得到两个独立实例，一次方法调用只作用于接收这次调用的那个实例。",
  constructor:
    "类型定义是创建对象的规则。创建实例时，构造或初始化过程接收本次参数，把初始值保存到这个对象的成员中。",
  encapsulation:
    "对象可以把内部数据设为private，再用public方法提供受控入口。方法先检查参数，通过检查才允许修改内部状态。",
  composition:
    "对象的成员也可以是另一个对象。player.position.x先找到player里的position，再访问position里面的x。",
  append:
    "有序序列可以在末尾追加内容。原来的元素仍然保留，size表示现在有多少个逻辑元素；追加后再遍历能访问新元素。",
  slice:
    "字符串是有顺序的字符序列。切片[start:end]不包括右边界end；切片得到新字符串，原来的字符串不会被剪掉。",
  unpack:
    "赋值先计算右边，再绑定左边。右边有多个值时，按位置分别交给左边的名字；交换时先固定右侧的两个原值。",
  dictionary:
    "字典保存键与值的对应关系。查找时使用键，不是列表下标；get可以在键不存在时返回指定的默认值。",
  set: "集合保存不同的值，没有列表那样的位置顺序。遇到已有的相同值时不会增加新元素，因此适合统计不同值的数量。",
  filter:
    "列表推导式把遍历、筛选和生成新值写在一起。先检查if条件，只有通过的元素才计算前面的表达式、进入新列表。",
  exception:
    "有些操作会失败并抛出异常。匹配的except负责处理这类失败；如果右侧计算失败，左侧的赋值就没有完成。",
  copy: "Python名字绑定对象。直接让b=a会共享同一个列表；a.copy()创建新的外层列表，本例替换b的整数元素不会改动a。",
};
export function lessonFoundation(lesson: Lesson): string {
  if (lesson.topic === "for")
    return lesson.language === "python"
      ? "循环让同一段缩进代码重复执行。for每轮把range给出的一个数交给i，range不包含右边界；total用来保留前面几轮的累加结果。"
      : "for循环先初始化变量，再判断条件；条件为真才执行循环体，然后更新变量，回到条件判断。total保留前面几轮的累加结果。";
  if (lesson.topic === "while")
    return "while每轮先判断条件，为真才执行循环体，再回到条件。循环体通常要推进变量，否则可能永远无法达到终止条件。";
  if (lesson.id === "python-16")
    return "类描述实例可以保存什么数据、执行什么操作。创建实例后用属性保存状态，方法里的self表示本次接收调用的那个实例。";
  if (lesson.id === "cpp-11")
    return "引用是已有对象的另一个名字，不是一个新的整数副本。通过ref修改后，用原变量名读取也会看到同一个对象的新值。";
  return primers[visualLesson(lesson).kind];
}
