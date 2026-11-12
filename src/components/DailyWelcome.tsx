import {useEffect,useState} from "react";
import SelectControl from "./SelectControl";
import { ArrowRight, ChevronDown, LoaderCircle, Send } from "lucide-react";
import type { DailyLearning } from "../hooks/useDailyPlan";
import type { Missions } from "../hooks/useMissions";
import { languages, type Language } from "../../shared/curriculum";

export default function DailyWelcome({ daily: d, missions: m, name, onOpen, onFlush }: {
  daily: DailyLearning; missions: Missions; name: string;
  onOpen: (id: string) => void; onFlush: () => Promise<unknown>;
}) {
  const [message, setMessage] = useState(""), [starting, setStarting] = useState(false);
  const [expanded, setExpanded] = useState(!m.active);
  useEffect(() => setExpanded(!m.active), [m.active?.id]);
  const active = m.active;
  const complete = !!d.plan && d.progress?.length === d.plan.steps.length && d.progress.every(p => p.state === "verified");
  const nextIndex = d.progress?.findIndex(p => p.state !== "verified") ?? 0;
  const nextStep = d.plan?.steps[Math.max(0, nextIndex)];
  // 每日安排是可恢复的计划，当前任务才是继续学习的身份；两者不同不能继续复述旧计划为当前任务。
  const outOfDate = !!active && !!d.plan && (active.goal.language !== d.plan.language || !d.plan.steps.some(s => s.lessonId === active.lessonId));
  const pending = d.busy || m.busy || starting;
  const reply = async () => {
    const submitted = message.trim();
    if (!submitted || d.busy) return;
    if (await d.prepare({ message: submitted })) setMessage(current => current.trim() === submitted ? "" : current);
  };
  const start = async (index: number) => {
    setStarting(true);
    try {
      await onFlush();
      if (d.progress?.[index]?.state === "verified" && d.plan?.steps[index]) return onOpen(d.plan.steps[index].lessonId);
      const id = await d.start(index);
      if (id) { await m.refresh(); onOpen(id); }
    } finally { setStarting(false); }
  };
  const refreshPlan = async () => {
    setStarting(true);
    try {
      await onFlush();
      await d.prepare(active ? { language: active.goal.language, message: "请结合我当前的学习任务和最新实际进度，重新安排今天接下来的一小步。" } : { message: "请结合最新学习记录，重新安排今天接下来的一小步。" });
    } finally { setStarting(false); }
  };
  const next = async () => {
    setStarting(true);
    try { await onFlush(); const value = await m.advance(); if (value) await d.prepare({ advance: true }); }
    finally { setStarting(false); }
  };
  const greeting = active
    ? m.progress?.canAdvance ? "当前任务已完成本次验证。接下来可以继续，也可以先回看自己的过程。" : "当前任务已为你保留。先把这一小步弄明白，再决定接下来学什么。"
    : d.plan?.greeting ?? (d.configured === false ? "先做一个小实验，或选择课程开始。连接AI后，可以根据你的学习记录安排下一步。" : "正在结合你的学习记录，准备今天的小目标。");
  return <section className={"daily-welcome modern-daily " + (active ? "has-current-task" : "")} aria-label="AI今日学习安排">
    <div className="modern-daily-summary">
      <div><span className="modern-daily-label">今日安排</span><h2>{active ? "先接着当前的问题。" : name + "，从一小步开始。"}</h2>
        <p>{greeting}</p>{!active && d.plan?.question && <p className="daily-question">{d.plan.question}</p>}</div>
      <button className="modern-daily-toggle" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls="daily-plan-details">{expanded ? "收起安排" : "查看与调整"}<ChevronDown size={16}/></button>
    </div>
    {outOfDate && <div className="modern-plan-notice"><span>已切换当前任务，今天保存的安排还没有同步。</span><button disabled={pending} onClick={() => void refreshPlan()}>{starting ? "正在更新…" : "结合当前任务重新安排"}</button></div>}
    {(d.loading || (!d.plan && d.busy)) && <p className="daily-wait" role="status"><LoaderCircle className="spin" size={16}/>正在准备今日安排…</p>}
    {!active && d.plan && !d.loading && <div className="modern-daily-next">
      <div><small>{complete ? "今天这份安排已检查完成" : "下一步"}</small><b>{complete ? "把刚刚的理解，再向前走一步。" : nextStep?.title}</b><span>{complete ? "已有的学习过程会继续保留。" : nextStep?.reason}</span></div>
      <button className="button primary" disabled={pending} onClick={() => complete ? void next() : void start(Math.max(0,nextIndex))}>{starting ? "正在准备…" : complete ? "安排下一小步" : "开始这个任务"}<ArrowRight size={16}/></button>
    </div>}
    <div id="daily-plan-details" hidden={!expanded} className="modern-daily-details">
      {d.plan && <>
        {active && <p className="daily-original-greeting">{outOfDate ? "以下是切换任务前保存的安排。" : "原安排说明：" + d.plan.greeting}</p>}
        <div className="daily-time" aria-label="今天的学习时间"><span>今天学多久</span>{[10,20,35].map(n=><button key={n} disabled={pending} aria-pressed={d.plan?.budget===n} onClick={()=>void d.prepare({minutes:n})}>{n}分钟</button>)}<SelectControl label="今日学习语言" compact value={d.plan.language} disabled={pending} onValueChange={value=>void d.prepare({language:value as Language})} options={languages.map(l=>({value:l.id,label:l.name}))}/></div>
        <form className="daily-reply" onSubmit={e=>{e.preventDefault();void reply();}}><input aria-label="告诉AI今天的想法" value={message} maxLength={500} onChange={e=>setMessage(e.target.value)} placeholder="今天哪里没懂，或者想调整安排…"/><button aria-label="回应今日AI老师" disabled={d.busy||!message.trim()}><Send size={17}/></button></form>
        <ol className="modern-daily-agenda">{d.plan.steps.map((step,index)=><li key={step.lessonId}>
          <span className={"modern-plan-step "+(d.progress?.[index]?.state==="verified"?"verified":"")}>{index+1}</span><div><strong>{step.title}</strong><small>{step.minutes}分钟 · {d.progress?.[index]?.text??"待开始"}</small><p>{step.reason}</p></div>
          <button disabled={pending||!!(d.progress?.[index]?.state!=="verified"&&active&&active.goal.language===d.plan?.language&&active.lessonId!==step.lessonId&&!m.progress?.canAdvance&&step.kind!=="review")} aria-label={(d.progress?.[index]?.state==="verified"?"回看":"开始")+"今日安排："+step.title} onClick={()=>void start(index)}>{d.progress?.[index]?.state==="verified"?"回看":d.progress?.[index]?.state==="coding"||d.progress?.[index]?.state==="opened"?"继续":"开始"}<ArrowRight size={14}/></button>
        </li>)}</ol>
      </>}
      {!d.plan&&!d.loading&&!d.busy&&<p className="modern-daily-empty">{d.configured===false?"连接AI后会生成个性化安排。已有课程和真实运行随时可以使用。":"暂时还没有今日安排。"}</p>}
      {d.busy&&d.plan&&<p role="status" className="daily-wait"><LoaderCircle size={14} className="spin"/>正在调整，原计划仍然保留…</p>}
    </div>
    {d.error&&<p className="daily-error" role="alert">{d.error}<button disabled={pending} onClick={()=>message.trim()?void reply():void d.prepare()}>{message.trim()?"重试这次调整":"重新读取安排"}</button></p>}
  </section>;
}
