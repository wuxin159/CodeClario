import type { Language, Lesson } from "./curriculum.ts";
import type { Question } from "./teaching.ts";
import { BUBBLE_INPUT, bubbleProgram, buildBubbleScene } from "./bubbleSort.ts";

const testInputs = [BUBBLE_INPUT, [5, 4, 3, 2, 1], [1, 2, 3, 4, 5], [3, 1, 3, 2, 1], [0, -2, 4, -2, 1], [7, 7, 7, 7, 7]];
const tests = testInputs.map(input => ({ input: input.join("\n"), expected: [...input].sort((a, b) => a - b).join("\n") }));

export const bubbleExtensions = (["c", "cpp", "python"] as Language[]).map(language => {
  const python = language === "python";
  const sections = [
    { title: "把大任务拆成一次比较", text: "要把五个数按从小到大排列，不必一次决定所有位置。先只看相邻的numbers[j]与numbers[j+1]：左边更大就交换，否则保持原样。重复这个小规则，就能逐步整理整个数组。" },
    { title: "先看一轮，再理解两层循环", text: "从左向右比较时，大的数会不断被带向右边。一轮结束，本轮最大值一定在最右端，但左边通常还没排好。外层pass_index决定第几轮；内层j负责这一轮逐对比较，每一轮j都重新从0开始。本课用固定四轮的基础版，先读懂循环，不加入提前退出优化。" },
    { title: "为什么要用temp，为什么边界要减一", text: "交换时先把左值保存到temp，再把右值写到左边，最后把temp写到右边；如果直接连续覆盖，就会丢掉一个原值。因为要访问j+1，内层必须满足j < n-1-pass_index：既不越界，也不再触碰右边已经就位的元素。相等时不交换，可保留相同值的原先顺序。" },
    { title: `${python ? "Python列表" : language === "c" ? "C数组" : "C++原生数组"}中的写法`, text: python
      ? "numbers保存五个整数，numbers[j]访问第j项。range(n-1)给出0到n-2，range(n-1-pass_index)控制本轮比较范围。此课先用temp完成三次赋值，不依赖列表推导式、sort或元组交换。输入部分把五次int(input())的结果依次放进列表，后面的两层for才是排序的核心。"
      : "numbers[5]提供五个位置，用已学过的for读入每项。外层和内层各有自己的循环变量；int temp在交换时保存左边的旧值。此处使用原生数组和赋值，不需要指针操作、容器或排序库。" },
    { title: "从观察到自己验证", text: "先播放一轮，预测哪个数会就位；再查看完整排序，并解释内层范围为何逐轮缩短。练习程序只做了一轮，请修正外层循环，使任意五个输入都能升序输出。用混合、倒序、已排序、重复值和负数检查，不要只记住示例答案。" },
    { title: "进一步想：比较次数与交换次数", text: "五项的四轮分别比较4、3、2、1次，总共10次。交换次数则取决于输入：已经有序时一次也不用交换，但这个基础版仍会完成10次比较。先能解释这两个计数，再考虑如何在某轮没有交换时提前结束。" },
  ];
  const questions: Question[] = [
    { id: "prediction", prompt: "对[5,1,4,2,3]从左到右进行一整轮相邻比较与交换后，数组是什么？", options: ["[1,4,2,3,5]", "[1,2,3,4,5]", "[5,4,3,2,1]"], correct: 0, explanation: "5依次与1、4、2、3交换，最终到右端；左边的4、2、3还没有排好。一轮并不等于完整排序。" },
    { id: "review", prompt: "五个元素完成第一轮后，下一轮为什么只需比较下标(0,1)、(1,2)、(2,3)？", options: ["因为j从1开始", "因为下标4处的最大值已就位，且访问j+1必须合法", "因为数组只剩三个元素"], correct: 1, explanation: "元素没有被删除。只是右端最大值已确定，不再参与下一轮比较；j取0、1、2，所以j+1最多为3。" },
  ];
  const lesson: Lesson = {
    // 新增稳定ID，使用order插入数组课之后；不改旧课程index与历史记录的关联。
    id: `${language}-19`, language, index: 18, order: 75, topic: "bubble-sort",
    title: "冒泡排序：循环与数组综合实践", subtitle: "用相邻比较和交换，把循环与下标串成一个完整算法。", minutes: 28,
    concepts: ["冒泡排序", "嵌套for循环", "数组下标", "比较与交换", "有序边界"],
    explanation: sections.slice(0, 2).map(section => section.text),
    task: "输入五个整数，每行一个。修正程序中只执行一轮的外层for循环，使用冒泡排序按从小到大输出这五个数，每个数占一行；保留所有重复值，支持负数，不要把结果写死。",
    starter: bubbleProgram(language, { onePass: true }), solution: bubbleProgram(language),
    stdin: BUBBLE_INPUT.join("\n"), expected: tests[0].expected, tests,
    hints: [
      "先检查做完一轮后的数组：最大值到右端了，但其余位置是否都有序？外层与内层循环的职责不同。",
      "五项最多需要四轮。每一轮j要重新从0开始，范围仍保留n-1-pass_index，避免重复处理已就位的尾部。",
      python ? "将range(1)改为range(n - 1)。交换时保留temp的三次赋值，并重新验证倒序和重复输入。" : "将外层pass_index < 1改为pass_index < n - 1。交换时保留temp的三次赋值，并重新验证倒序和重复输入。",
    ],
  };
  return { lesson, plan: {
    // 复用现有学习记录的课程版本协议；新课以独立ID区分，不另造会被记录读取器忽略的版本。
    version: "intro-v3", chapter: "循环与数组综合实践",
    goals: ["用相邻比较和交换拆解排序任务", "区分外层轮次与内层下标的职责", "解释已就位尾部和j+1的合法边界", "用多组输入验证完整排序"],
    prerequisites: ["已学for循环、条件比较与赋值", "已学数组/列表、从0开始的下标与遍历"],
    sections, questions, visualTitle: "一轮先确定一个最大值", takeaway: "把问题拆成一次可检查的比较，再用两层循环重复；通过边界和多组输入确认结果。",
  }, demo: buildBubbleScene(language, BUBBLE_INPUT, true) };
});
