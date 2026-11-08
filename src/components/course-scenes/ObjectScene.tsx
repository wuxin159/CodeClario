import { ArrowDown, ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import type { SceneProps } from "./sceneTypes";
import { shown } from "./sceneTypes";

export default function ObjectScene({lesson,scene,model:m,progress,inspect}:SceneProps) {
  const firstLinks=scene.steps.find(step=>step.links?.length)?.links??[];
  const first=firstLinks[0];
  const current=m.links[0];
  if(m.kind==="encapsulation") {
    const amount=m.from.values.amount,balance=m.values.balance??current?.fields.balance;
    const checked=typeof amount==="number",allow=checked&&amount>0;
    return <><div className="ls-public-entry"><small>公开方法</small><code>{checked?`deposit(${amount})`:m.from.output?"get()":"deposit(amount)"}</code></div><div className={`ls-validation ${checked?(allow?"allowed":"blocked"):""}`}><ShieldCheck size={23}/><code>amount &gt; 0</code><b>{checked?allow?"通过，允许写入":"未通过，拒绝修改":m.from.output?"通过get读取":"等待参数"}</b></div><div className="ls-protected-arrow"><ArrowDown/><span>{checked?allow?`增加${amount}`:"本次没有写入":m.from.output?"读取当前余额":"只有满足规则才能进入"}</span></div><button className="ls-private-state" onClick={()=>inspect("private balance","余额封装在对象内部。公开deposit方法先验证参数，非法输入不会改变内部状态；get方法只负责读取。") }><header><LockKeyhole size={16}/><code>private</code></header><span>balance</span><strong>{balance}</strong><small>{checked&&!allow?"仍然是10":allow?"10 + 5 = 15":"对象的内部状态"}</small></button><div className="ls-observation">访问入口和内部状态分开，规则决定一次修改是否生效。</div></>;
  }
  if(m.kind==="composition") {
    const fields=current?.fields??{};
    return <><div className="ls-member-path"><code>player</code><ArrowRight size={15}/><code>position</code><ArrowRight size={15}/><code>x</code></div><div className="ls-owner"><header><code>Player player</code><small>外层对象</small></header><div className="ls-owned"><header><code>Position position</code><small>成员对象</small></header><div className="ls-object-fields">{Object.entries(fields).map(([key,value])=><button key={key} className={m.changedFields.includes(key)?"changed":""} onClick={()=>inspect(`player.position.${key}`,key==="x"?"先经过player的position成员，再访问x。move只改变x，不会改动同级的y。":"y与x是Position中的两个独立字段；本次move没有写y。") }><code>{key}</code><b>{value}</b><span>{m.changedFields.includes(key)?"本次更新":"保持"}</span></button>)}</div></div></div><div className="ls-method-call"><code>{m.index===0?"等待move调用":m.index===1?"player.move(3)":"读取 position.x 与 position.y"}</code><span>{m.index===0?"Player拥有Position，不是两份互不相关的数据":m.index===1?"只沿层级路径更新x":"分别读取成员，x为3，y仍为0"}</span></div></>;
  }
  if(m.kind==="copy"||m.kind==="instances") {
    const copy=m.kind==="copy",isPython=lesson.language==="python";
    const names=copy?["a","b"]:isPython?["a","b"]:["counters[0]","counters[1]"];
    return <><div className="ls-instruction"><code>{copy?"b = a.copy()":isPython?"a.add(4)":"counters[0].add(4)"}</code><small>{copy?"新列表对象，独立的外层结构":"方法只作用于接收调用的实例"}</small></div><div className={`ls-object-pair ${copy?"lists":""}`}>{names.map((name,i)=>{
      const object=m.links[i],exists=Boolean(object),old=scene.steps[Math.max(0,m.index-1)].links?.[i];
      return <div key={name} className={`ls-instance ${exists?"":"pending"}`}><header><code>{name}</code><small>{exists?(copy?`列表 ${i===0?"A":"B"}`:`实例 ${i===0?"A":"B"}`):"尚未创建"}</small></header>{exists?<div className="ls-object-fields">{Object.entries(object.fields).map(([key,value])=><button key={key} className={old&&old.fields[key]!==value?"changed":""} onClick={()=>inspect(`${name}${copy?key:"."+key}`,copy?`这是列表${i===0?"A":"B"}中的一个位置。更换b[0]不会写入a[0]；本例的元素是整数。`:`这是${name}自己保存的字段。调用另一个实例的方法不会自动改变它。`) }><code>{key}</code><b>{value}</b><span>{old&&old.fields[key]!==value?"已改变":""}</span></button>)}</div>:<p>{copy?"执行copy后，b才绑定新列表。":"执行第二次创建后，才有这个实例。"}</p>}</div>;
    })}</div>{copy?<div className="ls-copy-boundary"><span>外层列表：A ≠ B</span><small>本例替换整数项；浅拷贝不会递归复制嵌套可变对象。</small></div>:<div className="ls-receiver"><ArrowRight size={20}/><code>{isPython?"self → a":"接收对象 → counters[0]"}</code><span>另一个实例保持自己的状态</span></div>}</>;
  }
  if(m.kind==="constructor") {
    const python=lesson.language==="python",complete=Boolean(current),arg=Number(m.values.start??7);
    return <><div className="ls-construction-request"><small>{python?"创建并初始化实例":"构造对象"}</small><code>{python?`counter = Counter(${arg})`:`Counter counter(${arg})`}</code></div><div className="ls-init-route"><div><code>start</code><b>{m.index>0||python?arg:"待传入"}</b></div><ArrowDown/><button onClick={()=>inspect(python?"__init__":"初始化列表",python?"__init__为已经创建的实例设置属性；它不返回新实例。self指向本次的counter。":"value(start)在对象构造时初始化value成员，不是之后再给未初始化成员随意赋值。") }><code>{python?"self.value = start":"value(start)"}</code><small>{python?"为本次实例设置属性":"成员初始化规则"}</small></button><ArrowDown/></div><div className={`ls-created-object ${complete?"ready":""}`}><header><code>counter.value</code><small>{complete?"初始化完成":python?"实例属性待写入":"等待构造"}</small></header><strong>{complete?current.fields.value:"—"}</strong></div><div className="ls-observation">{python?"self把初始化参数写入本次实例。":"每次创建对象，都使用本次传入的构造参数。"}</div></>;
  }
  // 类型定义不能提前显示未来实例的值；Python本例第0帧已调用显式的value=0初始化。
  const freshPython=lesson.id==="python-16"&&m.index===0;
  const directPoint=lesson.id==="c-17"&&m.index===0;
  const created=Boolean(current)||freshPython||directPoint;
  const fields=current?.fields??(freshPython?{value:0}:directPoint?{x:m.from.values["point.x"],y:m.from.values["point.y"]}:{});
  const definitions=Object.keys(first?.fields??{});
  const isPointer=lesson.id==="c-17",self=lesson.id==="python-16",readMembers=lesson.id==="c-16"||lesson.id==="cpp-13";
  const objectName=isPointer?"point":self||lesson.id==="cpp-14"?"counter":"point";
  return <>
    <div className="ls-type-definition"><small>{created?"对象遵循的类型":"先定义类型，还没有实例"}</small><code>{self||lesson.id==="cpp-14"?"Counter":"Point"}</code><div>{definitions.map(key=><span key={key}>{key}</span>)}{lesson.id==="cpp-13"&&<span>sum()</span>}{(self||lesson.id==="cpp-14")&&<span>add()</span>}</div></div>
    {isPointer?<div className="ls-member-path"><code>{m.index===0?"p尚未声明":"p"}</code><ArrowRight size={16}/><code>point</code><ArrowRight size={16}/><code>x</code></div>:self?<div className="ls-aliases"><code>counter</code><span>{m.index===2?"self → 同一实例":"名字绑定到实例"}</span><ArrowDown size={17}/></div>:<div className="ls-object-creation"><ArrowDown size={20}/><span>{created?"具体实例":"执行创建语句后才出现实例"}</span></div>}
    <div className={`ls-instance ls-single-object ${created?"":"pending"}`}><header><code>{objectName}</code><small>{created?"拥有自己的成员状态":"尚未创建"}</small></header>{created?<div className="ls-object-fields">{Object.entries(fields).map(([key,value])=><button key={key} className={`${m.changedFields.includes(key)?"changed":""} ${readMembers&&m.index>=2?"reading":""}`} onClick={()=>inspect(`${objectName}.${key}`,isPointer?`先沿p找到point，再选${key}成员。本次只写x，因此y保持3。`:self?`方法中的self指向counter；${key}是这个实例的属性。`:readMembers?`本次读取${key}，不修改它；读取的值用来求和。`:`add方法修改当前counter对象的${key}成员。`) }><code>{key}</code><b>{value}</b><span>{m.changedFields.includes(key)?"更新":readMembers&&m.index>=2?"读取":""}</span></button>)}</div>:<p>类型描述结构，实例才保存具体成员值。</p>}</div>
    {readMembers?<div className="ls-member-calculation"><code>{lesson.id==="cpp-13"?"point.sum()":"point.x + point.y"}</code><ArrowRight size={18}/><strong>{shown(m.values.sum??m.values.result)}</strong><small>{lesson.id==="cpp-13"?"成员函数读取自己的x、y并返回结果":"读取两个成员后相加"}</small></div>:<div className="ls-method-call"><code>{isPointer?"p->x += 2":self?"counter.add() / self.value += 1":"counter.add()"}</code><span>{isPointer?"只选择x字段，y仍然保持不变":"方法作用于这个实例，没有创建第二个counter"}</span></div>}
  </>;
}
