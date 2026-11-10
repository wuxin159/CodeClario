import { ArrowDown, ArrowLeft, ArrowRight, CornerDownLeft } from "lucide-react";
import type { SceneProps } from "./sceneTypes";

export default function FundamentalsScene({ lesson, scene, model:m, progress, inspect }: SceneProps) {
  if (m.kind === "output") {
    const incoming = m.to.output.startsWith(m.from.output) ? m.to.output.slice(m.from.output.length) : "";
    const lines = m.from.output.split("\n").slice(0,-1);
    return <>
      <div className="ls-instruction"><small>当前语句</small><code>{scene.code.split("\n")[m.from.line-1]}</code></div>
      <div className="ls-output-flow"><ArrowDown/><span>按执行顺序追加</span>{incoming && progress>0 && <span className="ls-flow-text" style={{transform:`translateY(${progress*24}px)`,opacity:Math.sin(progress*Math.PI)}}>{incoming.replace(/\n/g," ↵")}</span>}</div>
      <div className="ls-terminal" aria-label="当前标准输出"><header>标准输出<small>{lines.length} 行已写入</small></header>{lines.map((line,i)=><button key={i} onClick={()=>inspect(`输出第${i+1}行`,"这一行已经输出。下一条输出语句追加在后面，不会覆盖它。") }><small>{i+1}</small><code>{line || "空行"}</code><span>↵</span></button>)}<div className="ls-caret"><small>{lines.length+1}</small><i/><span>{lines.length ? "下一次从这里继续" : "等待第一条输出"}</span></div></div>
      <button className="ls-observation" onClick={()=>inspect("换行",lesson.language === "python" ? "本例print默认在末尾换行；改用end参数会改变这个行为。" : "本例输出语句包含换行；文字和换行都是输出流中的内容。") }><CornerDownLeft size={16}/> 换行改变下一次写入的位置</button>
    </>;
  }
  if (m.kind === "assignment") {
    const python = lesson.language === "python", ready = typeof m.from.values.answer === "number";
    const rhs = m.from.values["右值"], nextValue = m.to.values.answer;
    const writing = progress>0 && nextValue !== m.from.values.answer;
    return <>
      <div className="ls-assignment-rule"><code>{python ? "名字 → 对象" : "右侧求值 → 写入变量"}</code><small>{python ? "绑定关系示意，不表示内存地址" : "本例变量类型：int"}</small></div>
      <div className={`ls-assignment ${python ? "is-binding" : "is-storage"}`}>
        <button className="ls-name" onClick={()=>inspect("answer",python ? "answer是名字。重新赋值会改变它绑定的对象，不是修改整数对象本身。" : "answer是本例的整型变量，赋值把右侧的值写入这个变量。") }><small>{python ? "变量名" : "变量"}</small><code>answer</code>{!python && <b>{ready ? m.from.values.answer : "尚未初始化"}</b>}</button>
        <div className="ls-binding-line">{python?<ArrowRight size={30}/>:<ArrowLeft size={30}/>}{writing && <b className="ls-transfer-value" style={{transform:`translateX(${(python?progress-.5:.5-progress)*55}px)`,opacity:Math.sin(progress*Math.PI)}}>{nextValue}</b>}</div>
        <div className="ls-value-object"><small>{python ? "当前绑定的整数值" : "右侧求得的值"}</small><strong>{python ? ready ? m.from.values.answer : "尚未绑定" : rhs ?? (m.index>=3 ? m.from.values.answer : "待求值")}</strong>{python && m.index>=3 && <span>旧的整数值0没有被改成新值</span>}</div>
      </div>
      <ol className="ls-mini-steps"><li className={m.index===2?"active":""}>先求右侧</li><li className={m.index===3?"active":""}>{python ? "更新绑定" : "写入左侧"}</li><li className={m.index===4?"active":""}>读取当前值</li></ol>
      <div className="ls-observation">{m.index===0 ? python ? "赋值发生之前，还不能读取answer。" : "这一帧尚未完成初始化。" : m.index===2 ? `右侧已得到${rhs}，answer仍保持${m.from.values.answer}。` : python ? "后续读取answer，得到它现在绑定的值。" : "后续读取answer，得到最后一次写入的值。"}</div>
    </>;
  }
  if (m.kind === "division") {
    const n=Number(m.values.n), unit=60, quotient=Math.trunc(n/unit), remainder=n%unit;
    const groups=[...Array.from({length:quotient},()=>unit),remainder];
    return <>
      <div className="ls-measure-total"><strong>{n}<small>秒</small></strong><span>每60秒组成一个完整分钟</span></div>
      <div className="ls-minute-groups">{groups.map((size,i)=><button key={i} className={size<unit?"remainder":""} onClick={()=>inspect(size===unit?"完整的一组":"不足一组的余数",size===unit?"这60秒计为一个完整分钟，参与商的计数。":`${size}秒不足60秒，所以保留为余数，不增加完整分钟数。`)}><span>{size===unit?`第${i+1}个完整分钟`:"剩下的部分"}</span><div><i style={{width:`${size/unit*100}%`}}/></div><b>{size}秒</b></button>)}</div>
      <div className="ls-two-results"><div><code>n {lesson.language==="python"?"//":"/"} 60</code><strong>{m.values["整分钟"]??m.values.minutes??"待求商"}</strong><small>完整组的数量</small></div><div><code>n % 60</code><strong>{m.values["余秒"]??m.values.seconds??"待求余"}</strong><small>分组之后的剩余</small></div></div>
      <div className="ls-observation">{quotient} × 60 + {remainder} = {n}，两部分合起来才是原数。</div>
    </>;
  }
  const condition=scene.code.match(/age\s*(>=|>)\s*(\d+)/), op=condition?.[1]??">", boundary=condition?.[2]??"20";
  return <>
    <div className="ls-branch-input"><code>age = {m.values.age}</code><ArrowDown size={18}/></div>
    <button className="ls-condition-gate" onClick={()=>inspect("条件边界",`当前条件是age ${op} ${boundary}。${op===">"?"等于边界时不成立。":"等于边界时也成立。"} 可以切换初始/修正示例并改变输入观察选路。`)}><code>{m.values.age} {op} {boundary}</code><b>{m.from.branch===undefined?"等待判断":m.from.branch?"成立":"不成立"}</b></button>
    <div className="ls-branches">{[true,false].map((branch)=><div key={String(branch)} className={m.from.branch===branch?"selected":""}><span>{branch?"if · 真":"else · 假"}</span><ArrowDown size={24}/><button onClick={()=>inspect(branch?"if分支":"else分支",m.from.branch===undefined?"条件尚未判断，当前还没有选中任何分支。":m.from.branch===branch?"本次只执行这条路径。":"本次不会执行这条路径，也不会产生它的输出。") }><code>{branch?"adult":"minor"}</code><small>{m.from.branch===undefined?"候选路径":m.from.branch===branch?"本次路径":"未执行"}</small></button></div>)}</div>
    <div className="ls-observation">{m.from.output ? `实际输出：${m.from.output}` : "先判断，再进入一条分支；两条路径不会一起执行。"}</div>
  </>;
}
