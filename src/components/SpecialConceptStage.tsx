import {useEffect,useState} from "react";
import type {Lesson} from "../../shared/curriculum";
import type {Scene} from "../../shared/scenes";
import {lessonVisualState} from "../../shared/visualLessons";

/** 新知识点的专门图形：只读取审校快照，不用图形推断学生程序的执行结果。 */
export default function SpecialConceptStage({lesson,scene,time,onInspect,onAsk}:{lesson:Lesson;scene:Scene;time:number;onInspect:()=>void;onAsk?:(text:string)=>void}) {
  const m=lessonVisualState(scene,time),[selected,setSelected]=useState<{title:string;text:string}>();
  useEffect(()=>setSelected(undefined),[scene.id,m.index]);
  const inspect=(title:string,text:string)=>{onInspect();setSelected({title,text});};
  const details=selected&&<aside className="ls-inspection selected"><b>{selected.title}</b><p>{selected.text}</p>{onAsk&&<button onClick={()=>onAsk(`请结合当前示例第${m.index+1}步，解释「${selected.title}」。`)}>向AI问这一处</button>}</aside>;
  if(lesson.topic==="practice-flow"){
    const i=m.from.output?Infinity:Number(m.values.i),total=Number(m.values.total??0),accepted=m.history.filter(s=>s.line===4).map(s=>Number(s.values.i));
    return <div className="concept-stage special-concept-stage"><div className="concept-heading"><b>遍历范围与参与累加，是两个决定</b><small>示例：1到6中的偶数和</small></div>
      <div className="practice-number-strip">{[1,2,3,4,5,6].map(n=><button key={n} className={`${n===i?'current':''} ${accepted.includes(n)?'accepted':''}`} onClick={()=>inspect(`数字${n}`,`${n}在循环范围内，${n%2===0?'满足偶数条件，应该参与累加':'不满足偶数条件，只经过而不加入总和'}。`)}><strong>{n}</strong><span>{n%2===0?'可加入':'跳过'}</span></button>)}</div>
      <div className="practice-state-grid"><section><small>当前筛选条件</small><code>{i<=6?`${i} % 2 == 0`:'范围处理完毕'}</code><span>{i<=6?(i%2===0?'满足条件':'不满足条件'):'退出循环'}</span></section><section><small>已经加入的数字</small><b>{accepted.length?accepted.join(' + '):'还没有'}</b></section><section><small>累加器 total</small><strong>{total}</strong></section></div>
      <p className="special-scene-takeaway">先遍历1到6，再由条件筛选；不要把循环边界当成筛选条件。</p>{details}</div>;
  }
  if(lesson.topic==="practice-array")return <div className="concept-stage special-concept-stage"><div className="concept-heading"><b>候选最大值来自已经读过的数据</b><small>示例全部是负数</small></div>
    <div className="practice-number-strip">{m.items.map((value,i)=><button key={i} className={m.from.active===i?'current':''} onClick={()=>inspect(`numbers[${i}]`,m.from.active===i?`当前正在比较这个位置的${value}。`:`下标${i}的值是${value}，所有元素都需要参与比较。`)}><strong>{value}</strong><span>下标 {i}</span></button>)}</div>
    <div className="practice-state-grid"><section><small>当前元素</small><strong>{m.from.active===undefined?'—':String(m.items[m.from.active])}</strong></section><section><small>维护的候选 maximum</small><strong>{m.values.maximum??'尚未初始化'}</strong></section></div>
    <p className="special-scene-takeaway">初始化为第一项。即使全部是负数，也不会把不在数组里的0当成答案。</p>{details}</div>;
  const targets=[...new Map(m.links.map(link=>[link.to,link])).values()];
  const objectY=(name:string)=>targets.length===1?110:70+targets.findIndex(l=>l.to===name)*104;
  return <div className="concept-stage special-concept-stage"><div className="concept-heading"><b>{lesson.topic==="java-equality"?'先比较身份，再比较内容':lesson.topic==="class"?'每次new都创建一个独立对象':'变量保存引用，对象保存字段'}</b><small>课程关系示意</small></div>
    <svg className="reference-lesson-graph" viewBox="0 0 600 250" role="group" aria-label={m.links.map(l=>`${l.from}引用${l.to}`).join('；')}>
      {m.links.map((link,i)=>{const y=65+i*105,ty=objectY(link.to);return <g key={link.from}><path d={`M180 ${y} C255 ${y} 250 ${ty} 330 ${ty}`} fill="none" stroke="#7a9bc4" strokeWidth="2"/><path d={`M321 ${ty-5} L330 ${ty} L321 ${ty+5}`} fill="none" stroke="#7a9bc4" strokeWidth="2"/><g role="button" tabIndex={0} aria-label={`引用变量${link.from}`} onClick={()=>inspect(link.from,`${link.from}当前保存${link.to}的引用。改变引用和修改该对象的字段是不同的操作。`)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();inspect(link.from,`${link.from}指向${link.to}。`);}}}><rect x="15" y={y-44} width="170" height="88" fill="transparent"/><rect x="20" y={y-24} width="160" height="48" rx="8" fill="#f4f7fb" stroke="#b9cbe0"/><text x="100" y={y+5} textAnchor="middle">{link.from}</text></g></g>;})}
      {targets.map(link=>{const y=objectY(link.to);return <g key={link.to} role="button" tabIndex={0} aria-label={`${link.to} ${Object.entries(link.fields).map(([k,v])=>`${k}=${v}`).join(' ')}`} onClick={()=>inspect(link.to,`对象中的状态：${Object.entries(link.fields).map(([k,v])=>`${k}=${v}`).join('，')}。${m.links.filter(l=>l.to===link.to).map(l=>l.from).join('和')}可访问它。`)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();inspect(link.to,`${m.links.filter(l=>l.to===link.to).map(l=>l.from).join('和')}当前引用同一对象。`);}}}><rect x="334" y={y-41} width="245" height="82" rx="10" fill="#eaf2fc" stroke="#a9c3e1"/><text x="355" y={y-12} className="reference-object-title">{link.to}</text><text x="355" y={y+17}>{Object.entries(link.fields).map(([k,v])=>`${k} = ${v}`).join('，')}</text></g>;})}
    </svg>
    <p className="special-scene-takeaway">{m.values.比较??(targets.length<m.links.length?'两个箭头指向同一个对象；通过任何一个引用修改字段，另一边都能读到变化。':'不同对象分别保存状态。给变量重新赋值，只移动这个变量的箭头。')}</p>{details}
  </div>;
}
