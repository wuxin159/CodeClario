import { ArrowDown, ArrowLeft, ArrowRight, CornerDownRight, ShieldCheck } from "lucide-react";
import type { SceneProps } from "./sceneTypes";
import { shown } from "./sceneTypes";

export default function FlowScene({lesson,model:m,progress,inspect}:SceneProps) {
  if(m.kind==="character") {
    const character=String(m.values.ch??"'7'").replace(/'/g,""), encoded=character.charCodeAt(0), checked=m.values.is_digit!==undefined;
    return <><div className="ls-character-pair"><button onClick={()=>inspect("字符与整数",`字符'${character}'在本例ASCII编码中是${encoded}，不等于整数${character}。引号表示字符常量。`)}><small>字符</small><code>'{character}'</code></button><ArrowRight/><div><small>本例ASCII编码</small><b>{encoded}</b></div></div><div className="ls-digit-axis">{Array.from({length:10},(_,i)=><span key={i} className={String(i)===character?"selected":""}><b>'{i}'</b><small>{48+i}</small></span>)}</div><div className="ls-character-tests"><div><code>'0' ≤ ch</code><b>{checked?"成立":"待比较"}</b></div><span>并且</span><div><code>ch ≤ '9'</code><b>{checked?"成立":"待比较"}</b></div></div><div className="ls-reading-route"><code>is_digit</code><ArrowRight/><strong>{shown(m.values.is_digit)}</strong></div><div className="ls-observation">两侧比较都成立，逻辑与才得到真；本例用整数1表示真。</div></>;
  }
  if(m.kind==="exception") {
    const raised=m.index>=1,handled=m.index>=2;
    return <><div className="ls-instruction"><code>text = "abc"</code><small>输入仍然保留为字符串</small></div><div className={`ls-conversion ${raised?"failed":""}`}><code>int(text)</code><span>{raised?"抛出 ValueError":"等待转换"}</span></div><div className="ls-exception-fork"><button className="ls-unbound" onClick={()=>inspect("value不存在","转换先抛出异常，赋值没有完成，因此没有创建value绑定。它不是0，也不是None。") }><small>正常赋值路径</small><code>value</code><b>尚未绑定</b><span>{raised?"这次没有执行赋值":"等待转换成功"}</span></button><div className={`ls-handler ${handled?"active":""}`}><CornerDownRight/><code>except ValueError</code><span>{handled?"进入匹配的处理分支":"异常发生后匹配处理器"}</span><b>{m.from.output?m.from.output.trim():"尚未输出"}</b></div></div><div className="ls-observation"><ShieldCheck size={17}/>捕获异常后执行处理分支，不会回头补上失败的赋值。</div></>;
  }
  const pointer=lesson.id==="c-15",live=pointer&&(m.index===1||m.index===2),ended=m.index===3;
  const n=m.from.values["main.n"];
  return <>
    <div className="ls-scope-title"><span>调用方 main</span><small>{pointer?"对象一直由调用方持有":"n与形参value属于不同作用域"}</small></div>
    <button className="ls-caller-variable" onClick={()=>inspect("main.n",pointer?"函数接收地址关系，沿p写入的是这个对象本身。函数返回后，这个对象继续存在。":"add_one接收到n的值副本。main.n只有执行n=result后才改变。") }><code>n</code><b>{n}</b>{m.index>=2&&<span>5 → {n}</span>}</button>
    <div className={`ls-scope-bridge ${live?"active":""}`}>
      {pointer?<ArrowLeft/>:<ArrowDown/>}<span>{pointer?(live?"形参p指向调用方n":ended?"调用结束，形参p不再存在":"准备传入 &n"):(m.index===0?"传入n的值副本":m.index===1?"返回6，但n仍是5":"显式赋值 n = result")}</span>
      {progress>0&&!ended&&<i style={{transform:`translateX(${(progress-.5)*90}px)`,opacity:Math.sin(progress*Math.PI)}}/>}
    </div>
    <div className={`ls-callee-scope ${ended?"released":""}`}><header><code>{pointer?"increment":"add_one"}</code><small>{pointer?(live?"当前调用":ended?"已退出":"尚未进入"):m.index===0?"尚未调用":"调用过程示意 · 已返回"}</small></header>{pointer?<><div className="ls-parameter"><code>p</code><span>{live?"→ main.n":ended?"已离开作用域":"等待接收地址"}</span></div><p>{live?"没有复制另一个n；(*p)++修改同一对象。":ended?"局部形参结束，main.n中的修改保留。":"调用前先保留调用方的整数对象。"}</p></>:<><div className="ls-parameter"><code>value</code><b>{m.index>0?5:"—"}</b><span>值副本</span></div><div className="ls-return-expression"><code>return value + 1</code><ArrowRight size={17}/><b>{m.index>0?6:"—"}</b></div><p>本例计算value+1，没有把形参value改成6。</p></>}</div>
    {!pointer&&<div className="ls-scope-result"><code>result</code><b>{shown(m.values.result)}</b><span>{m.index===1?"返回值已经保存，等待写回n":m.index>=2?"写回后n才得到这个值":"尚未接收返回值"}</span></div>}
  </>;
}
