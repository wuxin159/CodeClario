import type { Lesson } from "./curriculum.ts";
import type { Scene } from "./scenes.ts";
import { sceneFrame, sequenceAt, objectLinksAt } from "./sceneMotion.ts";

export type VisualKind =
  | "output"
  | "assignment"
  | "division"
  | "branch"
  | "loop"
  | "array"
  | "call"
  | "character"
  | "cstring"
  | "matrix"
  | "scope"
  | "pointer"
  | "offset"
  | "record"
  | "instances"
  | "constructor"
  | "encapsulation"
  | "composition"
  | "append"
  | "slice"
  | "unpack"
  | "dictionary"
  | "set"
  | "filter"
  | "exception"
  | "copy";
export type VisualLesson = {
  kind: VisualKind;
  question: string;
  insight: string;
  legend: string;
};
const common: Record<string, VisualLesson> = {
  output: {
    kind: "output",
    question: "第二次输出，会覆盖第一行吗？",
    insight: "输出是按语句顺序追加的字符流，换行决定下一段文字的位置。",
    legend: "字符流 → 输出缓冲区",
  },
  variable: {
    kind: "assignment",
    question: "赋值时，右侧的值怎样到达左侧？",
    insight: "先求右侧，再更新左侧；读取变量时取得的是当前值。",
    legend: "求值 → 写入 → 再读取",
  },
  arithmetic: {
    kind: "division",
    question: "125秒里，有几个完整的60秒？",
    insight: "整除统计完整分组，取余保留未装满一组的部分。",
    legend: "完整组 / 剩余部分",
  },
  condition: {
    kind: "branch",
    question: "条件为假时，程序到底走哪条路？",
    insight: "只执行实际选中的分支；另一条路径不会产生输出。",
    legend: "蓝色：执行路径 · 灰色：未执行",
  },
  for: {
    kind: "loop",
    question: "边界上的那个数，真的参与了累加吗？",
    insight: "每次取值、判断与累加都有独立位置；边界被排除时不会进入循环体。",
    legend: "取值 → 累加 → 下一轮",
  },
  while: {
    kind: "loop",
    question: "循环变量怎样走到终止条件？",
    insight: "循环体负责累加，也必须推进变量；下一次判断为假后才离开循环。",
    legend: "条件 → 循环体 → 更新 → 回到条件",
  },
  array: {
    kind: "array",
    question: "遍历范围和数组长度，是一回事吗？",
    insight: "数据还在数组里，不等于已被遍历。未访问的元素不会进入累加器。",
    legend: "蓝色：已访问 · 虚线：范围外",
  },
  function: {
    kind: "call",
    question: "return的值，怎样回到调用的位置？",
    insight: "实参进入局部调用帧，return交还一个值；输出是调用处的另一个动作。",
    legend: "传参 → 局部帧 → 返回 → 输出",
  },
  pointer: {
    kind: "pointer",
    question: "沿着指针写入，哪个对象会改变？",
    insight: "箭头连接同一个有效对象；修改解引用结果，不会自动改变指针的指向。",
    legend: "箭头表示访问关系，非实际内存地址",
  },
  struct: {
    kind: "record",
    question: "类型、具体对象和成员，分别在哪里？",
    insight: "类型描述结构，实例拥有自己的字段；读取或写入会落到具体成员上。",
    legend: "类型定义 → 实例 → 成员访问",
  },
  class: {
    kind: "record",
    question: "方法里的修改，落在哪一个实例上？",
    insight: "方法作用于本次接收调用的对象，成员状态保存在这个实例中。",
    legend: "调用入口 → 当前实例 → 成员",
  },
  constructor: {
    kind: "constructor" as const,
    question: "创建对象时，初值怎样进入成员？",
    insight:
      "构造或初始化过程把本次传入值保存到新实例；定义类型本身不会创建全部实例。",
    legend: "创建请求 → 初始化 → 可读取的对象",
  },
  instances: {
    kind: "instances",
    question: "改变对象A，为什么对象B不跟着改变？",
    insight: "两次创建得到两个独立实例；一次方法调用只修改它的接收对象。",
    legend: "独立轮廓表示独立对象",
  },
};
const special: Record<string, VisualLesson> = {
  "c-9": {
    kind: "character",
    question: "字符7，为什么落在数字字符区间中？",
    insight:
      "分别比较下界与上界，再对两个布尔结果做逻辑与；字符与整数不是同一个概念。",
    legend: "'0' ≤ ch ≤ '9'",
  },
  "c-10": {
    kind: "cstring",
    question: "四个存储位置，为什么长度只有3？",
    insight: "字符串的结束符占一个位置，但strlen在结束符之前停止计数。",
    legend: "字符占位 / 结束符 / 逻辑长度",
  },
  "c-11": {
    kind: "matrix",
    question: "grid[行][列]具体选中了哪一个格子？",
    insight:
      "第一个下标定位行，第二个下标定位列；本例只读取主对角线的两个位置。",
    legend: "行 → 列 → 两个被读取的单元格",
  },
  "c-12": {
    kind: "scope",
    question: "函数改了形参，调用方的n为什么没变？",
    insight: "传入的是值的副本。返回结果和显式写回，是另外两个动作。",
    legend: "调用方 / 形参副本 / 返回结果",
  },
  "c-14": {
    kind: "offset",
    question: "p+2，是跳过两个元素还是两个字节？",
    insight:
      "这里按元素位置移动两个单位，再解引用第三个元素；不把示意图当作实际地址。",
    legend: "首元素 → 两个元素偏移 → 解引用",
  },
  "c-15": {
    kind: "pointer",
    question: "指针参数，怎样写回调用方的n？",
    insight:
      "调用传入地址关系；函数内沿形参p访问的，仍是调用方持有的同一个对象。",
    legend: "函数形参 → 调用方对象",
  },
  "c-17": {
    kind: "record",
    question: "p->x写入后，为什么y保持不变？",
    insight: "先沿p找到结构体，再选中x成员；写入只落到被选中的字段。",
    legend: "指针 → 结构体 → x成员",
  },
  "c-18": {
    kind: "array",
    question: "遍历结构体数组时，每次读的是哪个score？",
    insight: "数组中的每个对象拥有自己的score；逐个读取成员后才加入总分。",
    legend: "对象下标 → score → total",
  },
  "cpp-9": {
    kind: "append",
    question: "追加一个字符，字符串长度怎样变化？",
    insight: "原有字符保留，新的字符追加在末尾；size统计当前字符数。",
    legend: "原内容 / 新追加位置 / size",
  },
  "cpp-10": {
    kind: "append",
    question: "push_back之后，遍历能读到新元素吗？",
    insight:
      "新元素加入逻辑末尾，范围for遍历当前全部元素；本图不推测容器容量和内存地址。",
    legend: "原序列 → 末尾追加 → 遍历求和",
  },
  "cpp-11": {
    kind: "pointer",
    question: "ref是新整数，还是value的另一个名字？",
    insight: "引用绑定同一个对象；通过ref写入后，从value读取也会看到新值。",
    legend: "两个访问名字 → 同一个整数",
  },
  "cpp-16": {
    kind: "encapsulation",
    question: "为什么-3被拦下，而5可以改变余额？",
    insight: "公开方法先验证参数，只有满足规则的修改才能进入内部状态。",
    legend: "参数 → 验证门 → private状态",
  },
  "cpp-17": {
    kind: "composition",
    question: "player.position.x怎样一层层找到？",
    insight:
      "Player拥有Position成员对象；访问路径先经过position，再落到x字段。",
    legend: "Player 包含 Position，Position 包含 x/y",
  },
  "python-9": {
    kind: "slice",
    question: "text[:2]取走了原字符串吗？",
    insight: "右边界2不包括，结果是一个新字符串；原始text仍然保留全部字符。",
    legend: "原字符串 / [0,2)选区 / 新字符串",
  },
  "python-10": {
    kind: "unpack",
    question: "交换时，先改x会不会丢掉原来的值？",
    insight:
      "先计算并保存右侧两个值，再分别绑定左侧名字，所以不会边改边读取新值。",
    legend: "固定右侧快照 → 同时解包绑定",
  },
  "python-11": {
    kind: "dictionary",
    question: "查找pear，怎样到达对应的价格？",
    insight: "按键匹配对应关系，而不是按列表下标访问；不存在的键才走默认值。",
    legend: "查询键 → 匹配键 → 对应值",
  },
  "python-12": {
    kind: "set",
    question: "第二个2，为什么不会成为新的集合元素？",
    insight: "重复值映射到已有元素，集合只保留不同值；图中排布不代表集合有序。",
    legend: "重复值合流；集合无序",
  },
  "python-13": {
    kind: "filter",
    question: "筛选和平方，哪个先发生？",
    insight: "先检查n>0。被拒绝的输入不计算平方，也不会加入新列表。",
    legend: "输入 → 条件门 → n×n → 新列表",
  },
  "python-14": {
    kind: "exception",
    question: "转换失败后，value会被赋成什么？",
    insight:
      "转换抛出异常，赋值没有完成；执行转到匹配的except，value不会因此获得一个值。",
    legend: "失败路径 → 异常处理；未完成的赋值不提交",
  },
  "python-15": {
    kind: "copy",
    question: "浅拷贝之后，改b的首项会改变a吗？",
    insight:
      "本例复制后是两个列表对象；更改b的首个整数元素，不会写入a。嵌套可变对象的共享不在本例中。",
    legend: "复制产生新列表 / 本例整数元素独立替换",
  },
};
export function visualLesson(lesson: Lesson): VisualLesson {
  const spec =
    special[lesson.id] ??
    (Object.hasOwn(common, lesson.topic ?? "")
      ? common[lesson.topic ?? ""]
      : undefined);
  if (!spec) throw new Error(`课程缺少可视化设计：${lesson.id}`);
  return spec;
}
// An exact authored snapshot, never an interpolated integer or a trace of student code.
export function lessonVisualState(scene: Scene, time: number) {
  const frame = sceneFrame(scene, time),
    history = scene.steps.slice(0, frame.index + 1);
  const values = Object.assign({}, ...history.map((s) => s.values)) as Record<
    string,
    string | number
  >;
  const links = objectLinksAt(scene, frame.index).map((link) => ({
    ...link,
    label: frame.from.links ? link.label : "访问关系保留",
  }));
  return {
    ...frame,
    values,
    items: sequenceAt(scene, frame.index),
    links,
    visited: [
      ...new Set(
        history.flatMap((s) => (s.active === undefined ? [] : [s.active])),
      ),
    ],
    history,
  };
}
