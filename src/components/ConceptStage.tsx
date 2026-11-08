import { useEffect, useState, type CSSProperties, type HTMLAttributes } from "react";
import { ArrowRight, CornerDownLeft, ArrowDown, ArrowUp, Check } from "lucide-react";
import type { Lesson } from "../../shared/curriculum";
import type { Scene } from "../../shared/scenes";
import { sceneFrame } from "../../shared/sceneMotion";
import { loopPresentation, pointerPresentation } from "../../shared/classroomPresentation";

export function hasConceptStage(lesson: Lesson) {
  return ["for", "while", "function"].includes(lesson.topic ?? "") || ["c-13", "cpp-11", "cpp-12"].includes(lesson.id);
}

export default function ConceptStage({ lesson, scene, time, reduced = false, onInspect, onAsk }: {
  lesson: Lesson; scene: Scene; time: number; reduced?: boolean; onInspect: () => void; onAsk?: (text:string)=>void;
}) {
  const frame = sceneFrame(scene, time);
  const [selection,setSelection]=useState<{title:string;text:string}>();
  useEffect(()=>setSelection(undefined),[scene.id,frame.index]);
  const inspect=(title:string,text:string)=>{onInspect();setSelection({title,text});};
  const inspectable=(title:string,text:string):HTMLAttributes<HTMLDivElement>=>({role:"button",tabIndex:0,"aria-label":title,onClick:()=>inspect(title,text),onKeyDown:e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();e.stopPropagation();inspect(title,text);}}});
  const inspection=selection&&<aside className="ls-inspection selected" aria-live="polite"><b>{selection.title}</b><p>{selection.text}</p>{onAsk&&<button onClick={()=>onAsk(`请结合当前课程示例第${frame.index+1}步，解释「${selection.title}」为什么这样变化。`)}>向AI问这一处</button>}</aside>;
  const style = { "--step-progress": reduced ? 0 : frame.progress } as CSSProperties;
  if (lesson.topic === "for" || lesson.topic === "while") {
    const m = loopPresentation(lesson, scene, time);
    // for的更新和下一次判断在审校快照中合并；过渡阶段突出“更新”，数值仍等到下一帧提交。
    const visualPhase = !reduced && frame.progress > 0 && m.phase === 2 && frame.to.values.i !== frame.from.values.i ? 3 : m.phase;
    return <div className="concept-stage concept-loop" style={style} data-concept="loop" data-phase={m.phase}>
      <div className="concept-heading"><span>循环的执行路径</span><small>{m.pythonRange ? "依次取值" : "判断决定是否继续"}</small></div>
      <ol className="concept-process">{m.labels.slice(0, 4).map((label, i) => <li key={label} aria-current={visualPhase === i ? "step" : undefined}><span>{label}</span>{i < 3 && <ArrowRight size={13}/>}</li>)}</ol>
      <div className="loop-condition"><code>{m.pythonRange ? `range(1, ${m.bound})` : `i ${m.inclusive ? "≤" : "<"} ${m.bound}`}</code><span>{m.ended ? m.labels[4] : m.phase === 0 ? "准备开始" : m.phase === 1 ? m.pythonRange ? "取得当前项" : "条件成立" : m.labels[m.phase]}</span></div>
      <div className="loop-number-track" aria-label="循环参与范围">{Array.from({ length: m.bound }, (_, index) => index + 1).map(value => {
        const excluded = value === m.bound && !m.inclusive;
        const visited = m.additions.some(item => item.value === value);
        return <button key={value} className={`${excluded ? "excluded" : ""} ${visited ? "visited" : ""} ${m.current === value && !m.ended ? "current" : ""}`} onClick={()=>inspect(`循环取值${value}`,excluded?"这个数处于被排除的右边界，不进入本次循环体。":visited?"这一项已经加入total；total保留此前各轮的累加结果。":"这一项尚未完成累加，可以单步查看何时进入循环体。")} title={excluded ? "右边界不参与" : visited ? "已经加入总和" : "尚未累加"}><b>{value}</b><small>{excluded ? "不包含" : m.current === value && !m.ended ? "当前 i" : visited ? "已加入" : "待处理"}</small></button>;
      })}</div>
      <div className="loop-calculation"><div {...inspectable("当前循环变量i",m.current===undefined?"当前帧没有可读取的i；继续一步观察它何时建立，或查看循环退出后的作用域。":`i当前为${m.current}，它表示本轮处理的位置或取值，与累加器total不是同一个变量。`)}><small>当前取值 i</small><strong>{m.current ?? "—"}</strong></div><div className="concept-transfer" aria-hidden="true"><ArrowRight/></div><div className="loop-total" {...inspectable("累加器total",`total当前为${m.total}。它保存已经完成的累加结果，不会在每轮开始时自动清零。`)}><small>累加器 total</small><strong>{m.total}</strong></div>{!reduced && frame.progress > 0 && Number(frame.to.values.total) !== m.total && <span className="loop-data-token" aria-hidden="true" style={{ left: `${27 + frame.progress * 48}%`, opacity: Math.sin(frame.progress * Math.PI) }}>+ {frame.to.values.i}</span>}</div>
      <div className="concept-equation" aria-live="off">{m.operation ?? (m.ended ? `本次共完成 ${m.additions.length} 次累加` : m.phase === 0 ? "先让 total 从 0 开始" : `total 当前是 ${m.total}，每轮只加入当前的 i`)}</div>
      <div className="loop-history"><span>已经加入</span><p>{m.additions.length ? m.additions.map(a => a.value).join(" + ") : "还没有数字参与累加"}</p></div>
      <div className="concept-foot">{m.ended ? <Check size={16}/> : <CornerDownLeft size={16}/>}<span>{m.ended ? m.pythonRange ? "range 已用尽，i 保留最后一次取值。" : "离开循环体，继续执行后面的语句。" : m.pythonRange ? "取完当前项，再向 range 请求下一项。" : "循环体结束后再次判断，条件不成立才退出。"}</span></div>
      {inspection}
    </div>;
  }
  if (lesson.topic === "function") {
    const argument = scene.steps[0].values["实参"];
    const returned = frame.from.returned;
    const live = Boolean(frame.from.frame), finished = frame.index >= 3;
    return <div className="concept-stage concept-function" data-concept="function" style={style}>
      <div className="concept-heading"><span>一次函数调用</span><small>实参 → 局部变量 → 返回值</small></div>
      <div className={`call-frame caller ${!live ? "active" : ""}`} {...inspectable("函数调用处","调用表达式先等待函数交还一个值；得到返回值之后，外面的输出语句才继续执行。return和打印不是同一个动作。")}><div><b>调用处</b><small>{finished ? "继续执行" : "等待返回"}</small></div><code>{finished ? `square(${argument}) → ${returned}` : `square(${argument})`}</code><p>{frame.from.output ? `现在才输出：${frame.from.output.trim()}` : "输出语句等待函数交还一个值"}</p></div>
      <div className={`call-bridge ${live ? "active" : ""}`}>{returned !== undefined ? <ArrowUp size={19}/> : <ArrowDown size={19}/>}<span>{returned !== undefined ? `交还返回值 ${returned}` : live ? `形参 n 接收实参 ${argument}` : `传入实参 ${argument}`}</span><i className="call-packet" aria-hidden="true" style={{ opacity: reduced || frame.progress === 0 || ![0, 2].includes(frame.index) ? 0 : Math.sin(frame.progress * Math.PI), transform: `translateY(${(returned !== undefined ? 1 - frame.progress : frame.progress) * 38 - 19}px)` }}/></div>
      <div className={`call-frame local ${live ? "active" : ""} ${finished ? "released" : ""}`} {...inspectable("本次调用的局部变量n",live?`n目前为${frame.from.values.n}，只属于这次调用。函数返回之后，这个局部作用域结束。`:finished?"函数已经返回，本次局部变量不再可访问；返回值可以由调用方继续使用。":"尚未进入函数，本次调用的局部变量还没有建立。")}><div><b>square 的本次调用</b><small>{live ? "局部作用域" : finished ? "调用结束" : "等待创建"}</small></div><div className="call-local"><code>n</code><strong>{live ? frame.from.values.n : "—"}</strong><span>{live ? "仅属于这次调用" : finished ? "本次局部变量不再可访问" : "调用开始后建立局部变量"}</span></div>{live && returned !== undefined && <div className="return-value"><code>return {returned}</code><span>把值交还调用处</span></div>}</div>
      <div className="concept-foot"><CornerDownLeft size={16}/><span>return 交还一个值；打印由调用处的输出语句完成。</span></div>
      {inspection}
    </div>;
  }
  const m = pointerPresentation(scene, time), reference = lesson.id === "cpp-11";
  return <div className={`concept-stage concept-pointer ${m.linked ? "linked" : ""}`} data-concept={reference ? "reference" : "pointer"} style={style}>
    <div className="concept-heading"><span>{reference ? "两个名字，一个对象" : "沿指针访问同一个对象"}</span><small>对象关系示意</small></div>
    <div className="pointer-access" {...inspectable(reference?"引用ref":"指针p",!m.linked?"本帧尚未建立访问关系，继续一步可观察声明和初始化。":reference?"ref是value的别名，没有创建第二个整数。通过两个名字访问的是同一个对象。":"p保存指向value的地址关系；*p访问的是那个对象的值。两者含义不同。")}><small>{reference ? "访问名称" : "指针变量"}</small><code>{m.access}</code><span>{m.linked ? reference ? `是 ${m.name} 的别名` : `保存 ${m.name} 的地址` : reference ? "尚未绑定" : "尚未建立指向"}</span></div>
    <div className="pointer-wire"><span>{m.linked ? reference ? "访问同一对象" : `通过 *${m.access} 访问` : "等待建立关系"}</span><ArrowDown size={28}/>{!reduced && m.index < 2 && m.progress > 0 && <i className="pointer-signal" aria-hidden="true" style={{ transform:`translateY(${m.progress * 30}px)`, opacity:Math.sin(m.progress * Math.PI) }}/>}</div>
    <div className={`pointer-object ${m.changed ? "changed" : ""}`} {...inspectable(`${m.name}对象`,`当前值是${m.value}。${m.changed?"这次改变的是对象内容，对象身份和访问关系仍然保留。":m.linked?"原变量名和已建立的指针/引用访问的是这个对象。":"整数对象已经存在，指针或引用尚未与它建立关系。"}`)}><header><code>{m.name}</code><small>整数对象</small></header><div>{m.changed && <><s>{String(m.oldValue)}</s><ArrowRight size={24}/></>}<strong>{String(m.value ?? "—")}</strong></div><p>{m.changed ? "值已更新，对象还是同一个" : m.linked ? "可通过原变量名读取" : "先创建有效对象"}</p></div>
    <div className="concept-foot"><Check size={16}/><span>{reference ? "引用是别名，没有产生第二份整数副本。" : "改变对象的值，不等于改变指针的指向。"}</span></div>
    {inspection}
  </div>;
}
