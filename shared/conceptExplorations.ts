export type ExplorationObject = { name: string; fields: Record<string, string | number>; status?: string };
export type ConceptMoment = { title: string; note: string; line: number; objects: ExplorationObject[]; snapshot?: number[]; calculation?: string; moving?: string };
export type ConceptWalk = { title: string; code: string; moments: ConceptMoment[] };

/** 这些是可暂停的概念拆解，不替代主课程Scene，也不伪装成调试器采集的中间状态。 */
export function conceptWalk(lessonId: string): ConceptWalk | undefined {
  if (lessonId === "python-10") return {
    title: "解包：先保留右值，再分别绑定",
    code: "x, y = 2, 7\nx, y = y, x\nprint(x, y)",
    moments: [
      { title: "初始绑定", note: "先记住两个旧值。此时x是2，y是7。", line: 1, objects: [{name:"当前名字",fields:{x:2,y:7}}] },
      { title: "固定右侧", note: "先求右侧y、x，得到快照(7,2)。后续绑定都从这份快照取值。", line: 2, snapshot:[7,2], objects:[{name:"当前名字",fields:{x:2,y:7}}], moving:"7, 2" },
      { title: "绑定x", note: "把快照的第一项7绑定给x。旧x=2仍保存在右侧快照中，不会丢失。", line:2,snapshot:[7,2],objects:[{name:"当前名字",fields:{x:7,y:7}}],moving:"7 → x" },
      { title: "绑定y", note: "把快照的第二项2绑定给y。这里没有重新读取已经改变的x。",line:2,snapshot:[7,2],objects:[{name:"当前名字",fields:{x:7,y:2}}],moving:"2 → y" },
      { title: "读取结果",note:"整条赋值完成，输出7 2。分解中的绑定顺序不会改变右侧已求得的值。",line:3,snapshot:[7,2],objects:[{name:"当前名字",fields:{x:7,y:2}}] },
    ],
  };
  if (lessonId === "c-12") return {
    title: "值传递：返回值不会自动改写实参",
    code:"#include <stdio.h>\nint add_one(int value) { return value + 1; }\nint main(void) {\n    int n = 5;\n    int result = add_one(n);\n    n = result;\n    printf(\"%d\", n);\n    return 0;\n}",
    moments:[
      {title:"调用之前",note:"main持有n=5，尚未接收返回值。",line:4,objects:[{name:"main",fields:{n:5,result:"尚未赋值"}}]},
      {title:"传入值副本",note:"把n的值5传给形参value，两者属于不同作用域。",line:5,objects:[{name:"main",fields:{n:5,result:"等待返回"}},{name:"add_one",fields:{value:5},status:"当前调用"}],moving:"5 → value"},
      {title:"局部计算",note:"计算value+1得到6。本例没有把value本身改成6，main.n也仍然是5。",line:2,calculation:"5 + 1 = 6",objects:[{name:"main",fields:{n:5,result:"等待返回"}},{name:"add_one",fields:{value:5},status:"当前调用"}]},
      {title:"返回给result",note:"函数结束，返回值6写入result；main.n仍是5。",line:5,objects:[{name:"main",fields:{n:5,result:6}},{name:"add_one",fields:{},status:"局部作用域已结束"}],moving:"6 → result"},
      {title:"显式写回n",note:"执行n=result之后，main.n才变成6。返回和赋值是两个动作。",line:6,objects:[{name:"main",fields:{n:6,result:6}}],moving:"result → n"},
      {title:"输出",note:"读取更新后的n，输出6。",line:7,objects:[{name:"main",fields:{n:6,result:6}}]},
    ],
  };
  if (lessonId === "python-15") return {
    title:"浅拷贝：复制外层，再替换一项",
    code:"a = [3, 2]\nb = a.copy()\nb[0] += 10\nprint(a[0], b[0])",
    moments:[
      {title:"原列表",note:"a绑定列表A，此时还没有b。",line:1,objects:[{name:"列表A · a",fields:{"[0]":3,"[1]":2}}]},
      {title:"复制外层",note:"copy创建列表B。两份外层列表分别保存自己的元素位置。",line:2,objects:[{name:"列表A · a",fields:{"[0]":3,"[1]":2}},{name:"列表B · b",fields:{"[0]":3,"[1]":2}}],moving:"复制外层结构"},
      {title:"读取并计算",note:"从b[0]读出3，计算3+10得到13；此时尚未写回。",line:3,calculation:"3 + 10 = 13",objects:[{name:"列表A · a",fields:{"[0]":3,"[1]":2}},{name:"列表B · b",fields:{"[0]":3,"[1]":2}}]},
      {title:"写回B的首项",note:"只把列表B的首项替换为13，列表A仍然保留3。",line:3,objects:[{name:"列表A · a",fields:{"[0]":3,"[1]":2}},{name:"列表B · b",fields:{"[0]":13,"[1]":2}}],moving:"13 → b[0]"},
      {title:"分别读取",note:"输出3 13。本例是整数元素替换，浅拷贝不会递归复制嵌套的可变对象。",line:4,objects:[{name:"列表A · a",fields:{"[0]":3,"[1]":2}},{name:"列表B · b",fields:{"[0]":13,"[1]":2}}]},
    ],
  };
}

export type ContrastKind = "dictionary" | "exception" | "copy";
export const contrastForLesson = (id: string): ContrastKind | undefined => id === "python-11" ? "dictionary" : id === "python-14" ? "exception" : id === "python-15" ? "copy" : undefined;
export const contrastChoices: Record<ContrastKind, {value:string;label:string}[]> = {
  dictionary:[{value:"pear",label:"查找pear"},{value:"apple",label:"查找apple"},{value:"plum",label:"查找不存在的plum"}],
  exception:[{value:"abc",label:"文本abc"},{value:"123",label:"文本123"},{value:"-7",label:"文本-7"}],
  copy:[{value:"copy",label:"b = a.copy()"},{value:"alias",label:"b = a"}],
};
/** 有限输入由本地确定性规则推演；界面明确说明非沙箱执行，不写入课程成绩。 */
export function conceptContrast(kind: ContrastKind, raw: string) {
  const value=contrastChoices[kind].some(option=>option.value===raw)?raw:contrastChoices[kind][0].value;
  if(kind==="dictionary") {
    const data:Record<string,number>={apple:3,pear:5},found=Object.hasOwn(data,value),result=found?data[value]:0;
    return {title:"按键查找：存在与不存在",code:`prices = {"apple": 3, "pear": 5}\nname = "${value}"\nprice = prices.get(name, 0)\nprint(price)`,question:"print会输出什么？",answers:["0","3","5"],answer:String(result),output:String(result),note:found?`找到${value}，读取它对应的${result}。默认值0没有使用。`:`没有${value}这个键，所以get返回默认值0，不会新建这个键。`,objects:[{name:"prices（没有改变）",fields:data},{name:"本次查找",fields:{name:value,price:result}}],bindings:[]};
  }
  if(kind==="exception") {
    const valid=/^-?\d+$/.test(value),result=valid?Number(value):undefined;
    return {title:"转换输入：赋值还是进入except",code:`text = "${value}"\ntry:\n    value = int(text)\nexcept ValueError:\n    print("invalid")`,question:"这次会走哪条路径？",answers:["转换成功","进入except"],answer:valid?"转换成功":"进入except",output:valid?"": "invalid",note:valid?`转换成功，value绑定为${result}。这段程序只在except里打印，所以成功时没有标准输出。`:"转换失败，value不会获得绑定；执行匹配的except并输出invalid。",objects:[{name:"绑定与路径",fields:{text:value,value:result??"尚未绑定",路径:valid?"正常继续":"except ValueError"}}],bindings:[]};
  }
  const alias=value==="alias";
  return {title:"浅拷贝与别名：修改落在哪里",code:`a = [3, 2]\nb = ${alias?"a":"a.copy()"}\nb[0] += 10\nprint(a[0], b[0])`,question:"修改b[0]后，a[0]会跟着变化吗？",answers:["会","不会"],answer:alias?"会":"不会",output:alias?"13 13":"3 13",note:alias?"a和b指向同一个列表。通过b修改首项后，从a读取也得到13。":"a和b绑定不同的外层列表。替换b的首项不会改变a的首项。",objects:alias?[{name:"同一个列表A",fields:{"[0]":13,"[1]":2}}]:[{name:"列表A",fields:{"[0]":3,"[1]":2}},{name:"列表B",fields:{"[0]":13,"[1]":2}}],bindings:alias?["a → 列表A","b → 列表A"]:["a → 列表A","b → 列表B"]};
}
