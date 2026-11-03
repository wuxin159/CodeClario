import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Check, ChevronDown, LoaderCircle, Play, RotateCcw } from "lucide-react";
import { discoveryCheckLabel, type DiscoveryObservation, type DiscoverySession, type DiscoverySnapshot, type DiscoveryValues } from "../../shared/discovery";

function ValueFields({ values, onChange, disabled, label }: { values: { value: string; copy: string }; onChange: (v: { value: string; copy: string }) => void; disabled: boolean; label: string }) {
  return <fieldset className="discovery-prediction" disabled={disabled}><legend>{label}</legend>
    {(["value", "copy"] as const).map(key => <label key={key}><span>{key}</span><input type="number" inputMode="numeric" min={-1000} max={1000} placeholder="?" aria-label={`${label} ${key}`} value={values[key]} onChange={e => onChange({ ...values, [key]: e.target.value })} /></label>)}
  </fieldset>;
}
function ValuesGraph({ result, prediction }: { result: DiscoveryObservation; prediction?: DiscoveryValues }) {
  return <div className="discovery-values" aria-label="本次真实变量状态">
    <div className="discovery-pointer"><span>指针 p</span><svg viewBox="0 0 100 36" role="img" aria-label={result.trace.pointerTarget === "value" ? "本次调试采集到p指向value" : "本例源码中p指向value"}><path d="M4 18H85m-9-7 10 7-10 7" fill="none" stroke="currentColor" strokeWidth="2" /></svg><small>{result.trace.pointerTarget === "value" ? "实测指向 value" : "源码中指向 value"}</small></div>
    {(["value", "copy"] as const).map(key => <div key={key} className={`discovery-value ${prediction?.[key] !== null && prediction?.[key] !== undefined && prediction[key] !== result.values[key] ? "is-different" : ""}`}><span>{key}</span><strong>{result.values[key]}</strong>{prediction && <small>我的预期 {prediction[key] ?? "不确定"}</small>}</div>)}
  </div>;
}
function Code({ code, label }: { code: string; label: string }) {
  return <details className="discovery-code"><summary>{label}<ChevronDown size={14}/></summary><pre>{code}</pre></details>;
}
function PastEvidence({ folded, children }: { folded: boolean; children: ReactNode }) {
  return folded ? <details className="discovery-past"><summary>回看刚才的判断与对照<span>真实记录完整保留</span></summary>{children}</details> : <>{children}</>;
}
const emptyValues = () => ({ value: "", copy: "" });
const valuesOf = (v: { value: string; copy: string }): DiscoveryValues => ({ value: v.value.trim() === "" ? null : Number(v.value), copy: v.copy.trim() === "" ? null : Number(v.copy) });

export default function DiscoveryExperience({ userId, onContinue, compact = false, disabled = false }: { userId?: string; onContinue?: () => void; compact?: boolean; disabled?: boolean }) {
  const [session, setSession] = useState<DiscoverySession | null>(null), [loading, setLoading] = useState(true), [busyState, setBusy] = useState(false), [error, setError] = useState("");
  const busy = busyState || disabled;
  const [base, setBase] = useState(5), [values, setValues] = useState(emptyValues), [compare, setCompare] = useState(emptyValues), [check, setCheck] = useState(emptyValues), [reason, setReason] = useState("");
  const [configured, setConfigured] = useState(false), [revealed, setRevealed] = useState(false);
  const [reload, setReload] = useState(0);
  const owner = useRef(userId), generation = useRef(0), busyRef = useRef(false);
  owner.current = userId;
  const accept = (s: DiscoverySession | null) => {
    setSession(s); if (!s) return;
    setBase(s.initialValue); setReason(s.reason ?? "");
    if (s.prediction) setValues({ value: s.prediction.value === null ? "" : String(s.prediction.value), copy: s.prediction.copy === null ? "" : String(s.prediction.copy) });
    if (s.comparisonPrediction) setCompare({ value: s.comparisonPrediction.value === null ? "" : String(s.comparisonPrediction.value), copy: s.comparisonPrediction.copy === null ? "" : String(s.comparisonPrediction.copy) });
    if (s.checkResult) setCheck({ value: String(s.checkResult.prediction.value ?? ""), copy: String(s.checkResult.prediction.copy ?? "") });
    if (s.baseline) setRevealed(true);
  };
  useEffect(() => {
    const seq = ++generation.current, controller = new AbortController();
    setSession(null); setError(""); setLoading(true); setBusy(false); busyRef.current = false;
    setValues(emptyValues()); setCompare(emptyValues()); setCheck(emptyValues()); setReason(""); setRevealed(false);
    // 父页面尚在解析账户时不读取或认领游客状态，避免以未决身份覆盖刚恢复的账户。
    if (disabled) return () => { controller.abort(); generation.current++; };
    void (async () => {
      // 登录后只认领浏览器持有的游客体验，不迁移其他账户已拥有的记录。
      if (userId) {
        const claim = await fetch("/api/discovery/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }), signal: controller.signal });
        if (!claim.ok) { const problem = await claim.json(); throw Error(problem.error ?? "体验暂未保存到账户，请重新读取。"); }
      }
      const r = await fetch("/api/discovery/current", { signal: controller.signal }), data = await r.json() as DiscoverySnapshot & { error?: string };
      if (!r.ok) throw Error(data.error ?? "体验暂未载入。");
      if (seq !== generation.current || owner.current !== userId || controller.signal.aborted) return;
      if (data.userId !== (userId ?? null)) throw Error("账户已变化，请刷新页面后再试。");
      accept(data.session); setConfigured(data.configured);
    })().catch(e => { if (!controller.signal.aborted && seq === generation.current) setError(e.message); }).finally(() => { if (!controller.signal.aborted && seq === generation.current) setLoading(false); });
    return () => { controller.abort(); generation.current++; };
  }, [userId, disabled, reload]);
  async function action(path: string, body: object = {}) {
    if (busyRef.current || disabled) return null;
    busyRef.current = true; setBusy(true); setError(""); const who = userId, seq = generation.current;
    try {
      const r = await fetch("/api/discovery/" + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: who ?? null, ...body }), signal: AbortSignal.timeout(55000) }), data = await r.json();
      if (!r.ok) throw Error(data.error ?? "这一步没有完成，请重试。");
      if (owner.current !== who || seq !== generation.current) return null;
      accept(data.session); return data.session as DiscoverySession;
    } catch (e) {
      if (owner.current === who && seq === generation.current) setError((e as Error).name === "TimeoutError" ? "等待超时，你的判断已保留。请重试读取结果。" : (e as Error).message);
      return null;
    } finally { if (owner.current === who && seq === generation.current) { busyRef.current = false; setBusy(false); } }
  }
  async function begin() {
    const s = await action("start", { initialValue: base });
    if (s) { setValues(emptyValues()); setCompare(emptyValues()); setCheck(emptyValues()); setReason(""); setRevealed(false); }
  }
  const stage = session?.stage ?? "predict";
  const baselineCode = session?.code;
  return <section className={`discovery ${compact ? "discovery-compact" : ""}`} aria-label="预期与真实执行体验">
    <header className="discovery-heading"><div><span className="discovery-eyebrow">亲自判断 · 真实运行</span><h2>改了副本，原来的数会变吗？</h2><p>从一个小问题开始，看看自己的想法与程序运行有什么不同。</p></div>{session && <button type="button" className="discovery-restart" disabled={busy} onClick={() => { setBase(session.initialValue % 20 + 1); setSession(null); setValues(emptyValues()); setCompare(emptyValues()); setCheck(emptyValues()); setReason(""); setRevealed(false); setError(""); }} aria-label="重新开始小实验"><RotateCcw size={15}/><span>换个初始值再试</span></button>}</header>
    <ol className="discovery-stages" aria-label="体验进度">{[["predict", "说出预期"], ["compare", "做个对照"], ["check", "换题检验"]].map(([key, label], i) => <li key={key} aria-current={stage === key || (stage === "complete" && key === "check") ? "step" : undefined}><span>{i + 1}</span>{label}</li>)}</ol>
    {loading ? <p className="discovery-status" role="status"><LoaderCircle className="spin" size={18}/>正在恢复这次体验…</p> : !session ? <div className="discovery-intro">
      <div className="discovery-story"><div className="discovery-token"><span>原来的数 value</span><strong>{base}</strong></div><span className="discovery-copy-arrow">复制一份 <ArrowRight size={20}/></span><div className="discovery-token"><span>副本 copy</span><strong>{base}</strong></div></div>
      <p>现在把 <code>copy</code> 加 1。你认为 <code>value</code> 会跟着改变吗？</p><div className="discovery-intro-actions"><label>初始值 <input type="number" min={1} max={20} value={base} aria-label="小实验初始值" onChange={e => setBase(Number(e.target.value))}/></label><button type="button" className="discovery-primary" disabled={busy} onClick={() => void begin()}>试着判断 <ArrowRight size={16}/></button></div><small>一个受审校的C语言案例。无需先学完整课程，体验记录与课程成绩分开。</small>
    </div> : <>
      {stage === "predict" && <div className="discovery-predict-stage"><div className="discovery-task"><span>这次只做了三件事</span><p>① 原值设为 <b>{session.initialValue}</b>　② 复制给 <code>copy</code>　③ 把 <code>copy</code> 加 1</p><Code code={baselineCode!} label="看看这段代码"/></div><ValueFields label="我的预期" values={values} onChange={setValues} disabled={busy}/><label className="discovery-reason">为什么这样想？<span>可选</span><textarea rows={2} maxLength={500} placeholder="例如：我觉得两个名字存的是同一个数…" value={reason} onChange={e => setReason(e.target.value)} disabled={busy}/></label><div className="discovery-actions"><button type="button" className="discovery-primary" disabled={busy} onClick={() => void action(`${session.id}/predict-run`, { prediction: valuesOf(values), reason })}>{busy ? <LoaderCircle className="spin" size={16}/> : <Play size={15}/>}运行，看看实际结果</button><button type="button" className="discovery-text-button" disabled={busy} onClick={() => { setValues(emptyValues()); void action(`${session.id}/predict-run`, { prediction: { value: null, copy: null }, reason }); }}>我不确定，先观察</button></div></div>}
      <PastEvidence folded={stage === "check" || stage === "complete"}>
      {session.baseline && <div className="discovery-observation"><div className="discovery-section-title"><h3>你的判断，遇上真实执行</h3><span>真实C程序 · {session.baseline.durationMs} ms</span></div><ValuesGraph result={session.baseline} prediction={session.prediction}/><p className="discovery-fact">这次实际得到：<code>value = {session.baseline.values.value}</code>，<code>copy = {session.baseline.values.copy}</code>。{session.prediction?.value === null ? "先记住这个观察，再试一个小变化。" : session.prediction?.value !== session.baseline.values.value ? "原值与你的预期不同，值得再分清是哪一步。" : "你对原值的判断与本次结果一致。"}</p>{revealed && <Code code={session.baseline.code} label="查看本次实际执行的代码"/>}</div>}
      {session.guide && <div className="discovery-guide"><div className="discovery-guide-label"><span>{session.guide.provider === "deepseek" ? "AI选择的对照实验" : "示例引导"}</span>{session.guide.provider === "guided" && <small>{configured ? "AI暂未完成，按审校案例继续" : "连接AI后，可根据你的解释选择实验"}</small>}</div><h3>{session.guide.title}</h3><p>{session.guide.summary}</p><details><summary>为什么做这个对照</summary><p>{session.guide.rationale}</p></details></div>}
      {stage === "compare" && session.comparisonCode && <div className="discovery-compare-stage"><div className="discovery-change"><span>只改这一处</span><code>{session.guide?.experimentId === "write-through-pointer" ? "copy += 1  →  *p += 1" : "打印 value, copy  →  打印 copy, value"}</code></div><Code code={session.comparisonCode} label="查看对照程序"/><p>{session.guide?.question}</p><ValueFields label="对照后的预期" values={compare} onChange={setCompare} disabled={busy}/><button type="button" className="discovery-primary" disabled={busy} onClick={() => void action(`${session.id}/compare`, { prediction: valuesOf(compare) })}>{busy ? <LoaderCircle className="spin" size={16}/> : <Play size={15}/>}运行对照实验</button></div>}
      {session.comparison && <div className="discovery-comparison"><h3>两个程序，实际改变了什么</h3><div className="discovery-comparison-grid"><article><span>原来的程序</span><strong>value {session.baseline!.values.value} <i>·</i> copy {session.baseline!.values.copy}</strong><pre>输出：{session.baseline!.stdout.trim()}</pre></article><article><span>{session.guide?.experimentId === "write-through-pointer" ? "沿指针修改原值" : "交换输出顺序"}</span><strong>value {session.comparison.values.value} <i>·</i> copy {session.comparison.values.copy}</strong><pre>输出：{session.comparison.stdout.trim()}</pre></article></div><p>{session.guide?.experimentId === "write-through-pointer" ? "修改copy改变的是副本；修改*p，改变的是p指向的value。两份数值各有自己的位置。" : "打印顺序改变了，但value与copy的值没有因此改变。读输出时，要核对最后打印的是哪个变量。"}</p></div>}
      </PastEvidence>
      {(stage === "check" || stage === "complete") && session.checkCode && <div className="discovery-check"><div className="discovery-section-title"><h3>换一个数，自己判断一次</h3><span>不计课程成绩</span></div><p>这次 <code>value = {session.initialValue + 3}</code>，复制之后执行 <code>*p += 2</code>。两个变量最后分别是多少？</p><Code code={session.checkCode} label="查看本次检验代码"/>{stage !== "complete" && <><ValueFields label="独立检查" values={check} onChange={setCheck} disabled={busy}/><div className="discovery-actions"><button type="button" className="discovery-primary" disabled={busy || !check.value.trim() || !check.copy.trim()} onClick={() => void action(`${session.id}/check`, { prediction: valuesOf(check) })}>{busy ? <LoaderCircle className="spin" size={16}/> : null}核对我的判断</button><button type="button" className="discovery-text-button" disabled={busy || session.checkHelpSeen} onClick={() => void action(`${session.id}/help`)}>给我一点提示</button></div></>}{session.checkHelpSeen && <p className="discovery-hint">p指向value，*p访问的就是原变量。copy已经复制了当时的数，之后不会自动跟随。看过提示后，本次结果会标记为辅助作答。</p>}{session.checkResult && <div className={`discovery-verdict ${session.checkResult.correct ? "passed" : "retry"}`} role="status"><span>{session.checkResult.correct && <Check size={17}/>} {discoveryCheckLabel(session.checkResult)}</span><p>{session.checkResult.correct ? "这次判断与真实执行一致。把这个区别带回你自己的代码中，再继续练习。" : `实际运行得到 value = ${session.checkObservation!.values.value}，copy = ${session.checkObservation!.values.copy}。可以再看一遍代码后订正，记录会保留这次尝试。`}</p></div>}</div>}
      {stage === "complete" && <div className="discovery-finish"><p>{userId ? "这段学习过程已保存在你的账户中。" : "体验已完成。登录后可以把这段过程保留到自己的学习记录。"}</p>{onContinue && <button type="button" className="discovery-primary" onClick={onContinue}>{userId ? "继续完整课程" : "登录，继续学习"}<ArrowRight size={16}/></button>}</div>}
    </>}
    {busy && <p className="discovery-status" role="status"><LoaderCircle className="spin" size={16}/>{stage === "predict" && session ? "正在真实运行，并选择接下来的小实验…" : "正在核对这一步，保留当前内容…"}</p>}
    {error && <div className="discovery-error" role="alert"><p>{error}</p><button type="button" className="discovery-text-button" disabled={busy} onClick={() => setReload(n => n + 1)}>重新读取这次体验</button></div>}
  </section>;
}

export function DiscoveryHistory({ userId, onOpen }: { userId?: string; onOpen?: () => void }) {
  const [items, setItems] = useState<DiscoverySession[]>([]), [error, setError] = useState("");
  useEffect(() => {
    setItems([]); setError(""); if (!userId) return;
    const c = new AbortController();
    void fetch("/api/discovery/history", { signal: c.signal }).then(async r => { const data = await r.json(); if (!r.ok || data.userId !== userId) throw Error(data.error ?? "实验记录暂未读取。"); if (!c.signal.aborted) setItems(data.items); }).catch(e => { if (!c.signal.aborted) setError(e.message); });
    return () => c.abort();
  }, [userId]);
  if (!items.length && !error) return null;
  return <section className="discovery-history"><div className="discovery-section-title"><div><h2>想法怎样变清楚</h2><p>预期、真实观察与本次检验，分别留下记录。</p></div>{onOpen && <button type="button" onClick={onOpen}>再做一个实验<ArrowRight size={15}/></button>}</div>{error && <p role="alert">{error}</p>}{items.slice(0, 5).map(s => <article key={s.id}><header><strong>副本与指针的小实验</strong><span>{discoveryCheckLabel(s.checkResult)}</span></header><dl><div><dt>最初判断</dt><dd>{s.prediction ? `value ${s.prediction.value ?? "不确定"} / copy ${s.prediction.copy ?? "不确定"}` : "尚未填写"}</dd></div><div><dt>实际观察</dt><dd>{s.baseline ? `value ${s.baseline.values.value} / copy ${s.baseline.values.copy}` : "尚未运行"}</dd></div><div><dt>接下来弄清什么</dt><dd>{s.guide?.rationale ?? "先说出自己的想法"}</dd></div></dl></article>)}</section>;
}
