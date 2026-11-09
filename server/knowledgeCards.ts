import type {Language} from "../shared/curriculum.ts";
export type ConceptCard={key:string;title:string;languages:Language[];lessonNumber:number;aliases:string[];text:string};
const all:Language[]=["c","cpp","python"];
// 审校误区卡片只解释概念和验证方法，不收录学生答案或完整参考解。
export const conceptCards:ConceptCard[]=[
 {key:"while-progress",title:"条件与变量更新",languages:all,lessonNumber:8,aliases:["停不下来","一直转","死循环","没有更新","不动i","一直加","无限循环"],text:"while每轮先判断条件。若条件依赖的变量一直不变，循环可能一直成立。先追踪条件读取了哪个变量，再看每轮是否推进它；程序超时只能说明这次未在限时内结束，不能仅凭超时断定唯一原因。"},
 {key:"inclusive-boundary",title:"最后一个值有没有参与",languages:all,lessonNumber:8,aliases:["少加一个","最后一个没加","漏掉最后","少算了","边界","包含n","等于的时候"],text:"求1到n的和时，要区分“到达n”和“处理了n”。分别记录进入条件、参与累加的当前值、更新后的值。零输入一次也不执行可能本来就正确，应用正数和边界输入核对漏项，不能只测0。"},
 {key:"loop-accumulator",title:"计数变量与累加器的分工",languages:all,lessonNumber:4,aliases:["两个数为什么","哪个数在变","加到哪里","记次数","总数一直为零","每次清零","篮子"],text:"循环变量表示当前处理的位置或数值，累加器保存之前各轮的结果。把累加器放在循环体内重新初始化，会丢掉已经累计的内容；先观察一轮前后的两个值，避免将位置变化当作总和变化。"},
 {key:"array-index",title:"位置编号与元素数量",languages:all,lessonNumber:5,aliases:["第一个是0","最后一格","超出范围","越界","indexerror","下标","长度和位置","五个为什么不是5"],text:"长度为n的序列有n个元素，但从0编号时最后一个有效下标是n-1。访问某个元素并不等于遍历全部元素。Python越界通常报IndexError；C/C++原生数组越界是未定义行为，不能把某次观察到的值说成语言保证。"},
 {key:"integer-remainder",title:"整份数量与剩余数量",languages:all,lessonNumber:7,aliases:["余下来","剩下几秒","整分钟","小数去哪了","除不尽","商和余数","取整"],text:"整数除法和余数回答不同问题：能分成多少完整份、还剩多少。C/C++整数除法向零截断；Python的//向下取整，不能直接混用负数情形的规则。先核对操作数类型、语言和符号。"},
 {key:"value-parameter",title:"形参副本与调用方变量",languages:["c"],lessonNumber:12,aliases:["函数里面改","外面没变","传进去以后","函数外还是原来","副本","值传递","局部变量"],text:"C的普通值参数复制实参的值，形参和调用方变量属于不同对象。函数得到新值，不等于调用方已经保存它；区分修改形参、返回一个值、调用方接收返回值三个动作。需要原地修改时应另外学习地址传参。"},
 {key:"reference-alias",title:"别名与新对象",languages:["cpp"],lessonNumber:11,aliases:["另一个名字","两个名字一个","引用","别名","函数里面改","外面也变","ref"],text:"C++引用是已有对象的别名，不会因为多了名字就多出一个对象。引用参数可以影响调用方；普通值参数是副本。先确定参数声明方式，再解释修改落在哪个对象。"},
 {key:"pointer-address",title:"地址、指向与对象的值",languages:["c"],lessonNumber:13,aliases:["箭头指向","地址里的数","星号","取地址","指针","解引用","p和*p","门牌号"],text:"指针保存地址，解引用访问那个地址对应的对象。改指针里的地址与通过指针改对象是两件事。实际地址可能随运行改变，教学只依赖同次轨迹中的关系，不把某个地址当作固定位置。"},
 {key:"cpp-pointer-address",title:"指针与对象地址",languages:["cpp"],lessonNumber:12,aliases:["箭头指向","地址里的数","星号","指针","解引用","p和*p"],text:"C++指针保存对象地址，*p访问它指向的对象；引用则直接作为对象别名使用。把地址变化和对象数值变化分别检查，空指针或失效指针不能安全解引用。"},
 {key:"pointer-stride",title:"指针前进一步的含义",languages:["c"],lessonNumber:14,aliases:["地址加1","地址加一","跳了四个","移动几个字节","偏移","指针加法"],text:"指针加1按其所指元素的大小移动，不是固定加1字节。数组元素连续，但只允许在有效范围内访问；不能把某次sizeof(int)的结果当作所有平台都固定相同。"},
 {key:"return-value",title:"返回结果需要接收",languages:all,lessonNumber:6,aliases:["算出来没用上","return和print","返回不打印","函数算了没变","结果没保存","返回值"],text:"return把结果交回调用位置，输出语句把内容写到屏幕。调用函数可以产生返回值，但若调用方不保存或使用它，原变量不会因此自动改变。函数内的局部变量与调用方作用域分开。"},
 {key:"cstring-end",title:"字符串到哪里结束",languages:["c"],lessonNumber:10,aliases:["字符串结束","最后的0","反斜杠0","空字符","strlen","句子到头","结束符"],text:"C字符串以空字符\\0作为结束标记。它占据一个数组位置，但strlen不把结束符算入字符数量。字符'0'与空字符\\0不同；数组容量、字符串长度和结束位置要分别说明。"},
 {key:"matrix-position",title:"二维数组先行后列",languages:["c"],lessonNumber:11,aliases:["第几排","行列反了","二维","两层下标","格子位置","先行后列"],text:"二维数组要用两个下标定位：先选行，再选该行中的列。嵌套循环的变量各负责一个方向。观察一组具体下标和对应元素，再检查每层循环各自的边界。"},
 {key:"vector-size",title:"容量和有效元素不是一回事",languages:["cpp"],lessonNumber:10,aliases:["vector","push_back","扩容","容器长度","追加","容量"],text:"vector的size表示已有元素数量，capacity表示当前存储容量。push_back增加一个元素；扩容可能使先前保存的地址、引用或迭代器失效。访问边界按size检查，不能按capacity猜测有效元素。"},
 {key:"python-binding",title:"名字绑定与重新赋值",languages:["python"],lessonNumber:2,aliases:["赋值后一起变","名字绑定","两个变量同一个","赋值就是复制","重新赋值"],text:"Python赋值把名字绑定到对象，不普遍等同于复制对象。给名字重新赋值与原地修改可变对象不同。整数不可变，列表可变，因此不能用同一个“格子复制”解释所有赋值。"},
 {key:"python-shallow",title:"浅拷贝只独立外层容器",languages:["python"],lessonNumber:15,aliases:["复制后还会变","copy以后","浅拷贝","里面的列表","嵌套列表","外层内层","共享修改"],text:"列表copy创建新的外层列表，但其中的元素仍引用原来的对象。对整数元素重新赋值通常只改变副本的位置；若元素本身是可变的嵌套列表，修改共享内层对象可能同时被两边看见。要先区分重新绑定和原地修改。"},
 {key:"python-unpack",title:"先求右侧，再依次绑定",languages:["python"],lessonNumber:10,aliases:["交换变量","x,y","解包","同时赋值","右边先算","临时值"],text:"Python多目标赋值先计算完整右侧结果，再按从左到右的顺序绑定左侧目标。交换x和y不会因为先更新x就丢掉原来的x。概念拆解可以显示中间绑定状态，但不应声称每个概念动作都有独立的调试器事件。"},
 {key:"python-get",title:"找不到键时的默认值",languages:["python"],lessonNumber:11,aliases:["字典没有这个","get默认","键不存在","找不到名字","字典插入","keyerror"],text:"字典按键查值。get(key, default)在键不存在时返回默认值，不会因为返回默认值就插入这个键；直接用方括号访问缺失键可能抛出KeyError。"},
 {key:"python-except",title:"失败语句没有完成赋值",languages:["python"],lessonNumber:14,aliases:["except","异常后变量","int转换失败","报错以后","输入字母","没有输出"],text:"异常会中断当前语句并查找匹配的处理分支。如果右侧转换失败，左侧赋值没有完成。代码若只在except中打印，成功路径可能本来就没有输出；不能把没有输出一律说成执行失败。"},
 {key:"slice-stop",title:"切片终点不包含",languages:["python"],lessonNumber:9,aliases:["切片少一个","冒号","右边不取","字符串截取","半开区间"],text:"常见正步长切片从起点开始，在终点之前停止；终点不包含。字符串不可原地修改，切片得到新字符串。空切片与越界单元素索引的行为不同，应按具体表达式判断。"},
 {key:"set-unique",title:"重复元素不增加数量",languages:["python"],lessonNumber:12,aliases:["集合顺序","set","重复项","去重","为什么数量没增加"],text:"集合保存不同的元素，重复添加同一个值不会增加元素数量。集合不是按索引访问的序列，不把一次打印出来的顺序当作固定排序。"},
 {key:"object-self",title:"方法作用于接收它的实例",languages:["python"],lessonNumber:16,aliases:["self","两个对象一起变","实例","对象自己的","方法改谁"],text:"self指向当前调用方法的实例。实例属性通常属于各自对象；类属性或共享可变对象另当别论。先找本次方法的接收者，再看修改的是哪个属性。"},
 {key:"bubble-pass",title:"一轮有序与整体有序",languages:all,lessonNumber:19,aliases:["冒泡","只排一轮","两层循环","排完还乱","相邻交换","最大值到右边"],text:"冒泡的一轮相邻比较通常只确定一个末端位置，不能据此认为整个数组已有序。内层负责相邻比较，外层控制继续处理的范围；重复值应保留，相等时是否交换影响相对顺序。"},
 {key:"learning-evidence",title:"运行通过与理解证据分开",languages:all,lessonNumber:1,aliases:["猜对就完成","运行成功就掌握","为什么没完成","样例通过","辅助通过","订正","复测"],text:"代码灵分别记录代码运行、样例结果、解释与理解检验。执行成功不等于样例全对；样例通过也不直接证明掌握。看过帮助后的订正与首次独立作答不同；额外诊断和截图讲解不计课程通过。"},
];
