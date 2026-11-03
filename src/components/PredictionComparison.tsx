import { useEffect, useState } from "react";
import { ArrowRight, Check, HelpCircle } from "lucide-react";
import type { Comparison, Prediction } from "../../shared/flow";
import type { RunResult } from "../../shared/curriculum";

export default function PredictionComparison({ prediction, comparison, result, stale, revisionKey, busy, loading, hasRun, onPredict }: {
  prediction?: Prediction; comparison?: Comparison; result: RunResult | null; stale: boolean;
  revisionKey: string; busy: boolean; loading: boolean; hasRun: boolean; onPredict: (value: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setDraft(""); setError(""); }, [revisionKey]);
  // 运行快照与教学记录分别恢复，不能在快照尚未回来时把已看过的结果回填成预测。
  const canPredict = !loading && !hasRun && (!result || stale);
  const save = async () => {
    setSaving(true); setError("");
    try { await onPredict(draft); } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };
  return <section className="prediction-comparison" aria-label="我的预期与真实输出">
    <div className="prediction-comparison-heading">
      <span>先想一想，再看见结果</span>
      {comparison && !stale && <small className={comparison.matches ? "matches" : "differs"}>
        {comparison.matches ? <Check size={13} /> : <HelpCircle size={13} />}
        {comparison.matches === true ? "本次预期一致" : comparison.matches === false ? "发现一个值得观察的差异" : "本次暂不能核对"}
      </small>}
    </div>
    {(prediction || result) && <div className="prediction-comparison-values">
      <div><small>我的预期{prediction?.kind === "variable" ? ` · ${prediction.target ?? "变量"}` : ""}</small><pre>{prediction ? prediction.value || "（无输出）" : "这次没有记录预期"}</pre></div>
      <ArrowRight size={18} aria-hidden="true" />
      <div><small>实际观察{stale ? " · 上次版本" : ""}</small><pre>{comparison?.actual ?? (result ? result.stdout || "（无标准输出）" : "运行后再揭晓")}</pre></div>
    </div>}
    {canPredict && <details className="prediction-comparison-form">
      <summary>{prediction ? "调整这份代码的输出预期" : "写下我的输出预期（可选）"}</summary>
      <p>不确定也可以直接运行。预期只记录你现在的判断，不计成绩。</p>
      <label>我觉得程序最后会输出<textarea rows={2} maxLength={1000} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="可以留空，表示你认为没有输出" /></label>
      <button className="button secondary" disabled={busy || saving} onClick={()=>void save()}>{saving ? "正在记录…" : "记录我的判断"}</button>
    </details>}
    {stale && <p className="prediction-comparison-stale">代码或输入已变化，重新运行后再核对。</p>}
    {error && <p role="alert" className="task-warning">{error}</p>}
  </section>;
}
