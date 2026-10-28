import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  LoaderCircle,
  LocateFixed,
  Sparkles,
  X,
} from "lucide-react";
import type { TeachingFlow } from "../hooks/useTeachingFlow";
import type { TeachingDecision } from "../../shared/flow";
import TeachingText from "./TeachingText";
import { findLesson } from "../../shared/curriculum";

export default function TeachingFlowPanel({
  flow,
  userId,
  onFocus,
  onRequireAuth,
  onRun,
  onEdit,
  onOpenLesson,
}: {
  flow: TeachingFlow;
  userId?: string;
  onFocus: (focus: NonNullable<TeachingDecision["focus"]>) => void;
  onRequireAuth: () => void;
  onRun: () => void;
  onEdit: () => void;
  onOpenLesson: (id: string) => void;
}) {
  const [kind, setKind] = useState<"output" | "variable" | "line">("output"),
    [prediction, setPrediction] = useState(""),
    [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false),
    [answer, setAnswer] = useState(""),
    [retestAnswer, setRetestAnswer] = useState<number | null>(null);
  const [key, setKey] = useState(""),
    [settings, setSettings] = useState(false),
    [localError, setLocalError] = useState("");
  const [dismissed, setDismissed] = useState("");
  const task = flow.task,
    decision = task?.decision;
  useEffect(() => {
    setRetestAnswer(null);
  }, [task?.id, task?.retest?.id]);
  const safe = async (fn: () => Promise<unknown>) => {
    setLocalError("");
    setSaving(true);
    try {
      await fn();
    } catch (e) {
      setLocalError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="teaching-flow">
      <div className="flow-heading">
        <span>
          <Sparkles size={17} />
          AI 学习引导
        </span>
        <button aria-label="AI连接设置" onClick={() => setSettings(!settings)}>
          连接设置
        </button>
      </div>
      <label className="flow-auto">
        <input
          type="checkbox"
          checked={flow.enabled}
          onChange={(e) => flow.toggleEnabled(e.target.checked)}
        />
        根据作答和运行结果主动分析
      </label>
      {!flow.configured && (
        <p className="flow-connection">
          AI尚未连接，学习记录仍会保存。
          <button
            onClick={() => (userId ? setSettings(true) : onRequireAuth())}
          >
            配置连接
          </button>
        </p>
      )}
      {settings && (
        <form
          className="flow-settings"
          onSubmit={(e) => {
            e.preventDefault();
            void safe(async () => {
              const response = await fetch("/api/ai/config", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, key, verify: true }),
              });
              const data = await response.json();
              if (!response.ok) throw new Error(data.error);
              setKey("");
              flow.setConfigured(true);
              setSettings(false);
            });
          }}
        >
          <label>
            DeepSeek API Key
            <input
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              maxLength={256}
              required
              aria-label="DeepSeek API Key"
            />
          </label>
          <small>只保存在服务内存中，服务重启后需重新配置。</small>
          <div>
            <button disabled={saving || !userId || !key.trim()}>
              {saving ? "正在验证…" : "验证并保存"}
            </button>
            <button
              type="button"
              onClick={() =>
                void safe(async () => {
                  const response = await fetch("/api/ai/config", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId }),
                  });
                  const data = await response.json();
                  if (!response.ok) throw new Error(data.error);
                  flow.setConfigured(!!data.configured);
                  setKey("");
                  setSettings(false);
                })
              }
            >
              移除个人密钥
            </button>
          </div>
        </form>
      )}
      <div className="flow-stages" aria-label="学习流程">
        {["预测", "执行", "引导", "复测"].map((label, i) => (
          <span
            key={label}
            className={
              (i === 0 && task?.prediction) ||
              (i === 1 && task?.attemptId) ||
              (i === 2 && decision) ||
              (i === 3 && task?.retestResult?.correct)
                ? "done"
                : ""
            }
          >
            {label}
          </span>
        ))}
      </div>
      {flow.loading ? <p className="flow-note">正在恢复学习任务…</p> : null}
      {flow.stale && (
        <p className="flow-stale">
          代码或输入已变化，以下是旧版本记录。重新预测或运行后更新。
        </p>
      )}
      {task && !flow.stale && !flow.busy && (
        <button className="flow-focus" onClick={() => void flow.retry()}>
          分析这次学习
          <ArrowRight size={13} />
        </button>
      )}
      <details
        className="flow-prediction"
        open={!task?.prediction || flow.stale || undefined}
      >
        <summary>
          {task?.prediction && !flow.stale
            ? "已保存我的预测 · 可重新预测"
            : "先预测这段代码会怎样"}
          <ChevronDown size={13} />
        </summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!userId) {
              onRequireAuth();
              return;
            }
            void safe(() =>
              flow.predict({
                kind,
                value: prediction,
                ...(kind !== "output" ? { target } : {}),
              }),
            );
          }}
        >
          <select
            aria-label="预测内容"
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            <option value="output">最终标准输出</option>
            <option value="variable">变量最终值（Python）</option>
            <option value="line">某行执行次数（Python）</option>
          </select>
          {kind !== "output" && (
            <input
              aria-label={kind === "line" ? "预测行号" : "预测变量名"}
              placeholder={
                kind === "line" ? "代码行号，例如 3" : "全局变量名，例如 total"
              }
              value={target}
              maxLength={41}
              onChange={(e) => setTarget(e.target.value)}
              required
            />
          )}
          <textarea
            aria-label="我的运行预测"
            placeholder={
              kind === "output"
                ? "按实际格式填写输出；也可以留空预测无输出"
                : "填写你预测的值"
            }
            value={prediction}
            maxLength={1000}
            onChange={(e) => setPrediction(e.target.value)}
          />
          <div>
            <button disabled={saving || flow.busy}>
              {saving ? "保存中…" : "保存预测"}
            </button>
            <button type="button" className="flow-text" onClick={onRun}>
              不确定，直接运行
              <ArrowRight size={12} />
            </button>
          </div>
        </form>
      </details>
      {task?.comparison && (
        <section
          className={`flow-comparison ${task.comparison.matches === false ? "diff" : ""}`}
        >
          <h3>
            {task.comparison.matches === true ? (
              <>
                <Check size={14} />
                预测与实际一致
              </>
            ) : task.comparison.matches === false ? (
              "发现一处预测差异"
            ) : (
              "预测等待核对"
            )}
          </h3>
          <small>{task.comparison.label}</small>
          <div>
            <section>
              <span>我的预测</span>
              <pre>{task.comparison.predicted || "（无输出）"}</pre>
            </section>
            <section>
              <span>真实结果</span>
              <pre>{task.comparison.actual ?? "暂不可核对"}</pre>
            </section>
          </div>
          {task.comparison.reason && <p>{task.comparison.reason}</p>}
        </section>
      )}
      {flow.busy && (
        <div className="flow-analyzing" role="status">
          <LoaderCircle size={16} className="spin" />
          <span>AI正在分析本次练习，安排下一步…</span>
          <button onClick={flow.stop} aria-label="停止主动分析">
            <X size={14} />
          </button>
        </div>
      )}
      {(flow.error || localError) && (
        <div className="flow-error" role="alert">
          {localError || flow.error}
          <button
            onClick={() => void flow.retry()}
            disabled={flow.busy || flow.stale}
          >
            重新分析
          </button>
        </div>
      )}
      {decision && dismissed !== `${task.id}:${task.updatedAt}` && (
        <section className="flow-decision" aria-label="AI教学建议">
          <div className="flow-decision-label">
            <span>
              AI ·{" "}
              {
                {
                  ask: "追问确认",
                  explain: "针对性讲解",
                  visualize: "观察引导",
                  retest: "迁移复测",
                  continue: "下一步建议",
                }[decision.action]
              }
            </span>
            <button
              aria-label="收起本条建议"
              onClick={() => setDismissed(`${task.id}:${task.updatedAt}`)}
            >
              <X size={13} />
            </button>
          </div>
          <h3>{decision.title}</h3>
          <TeachingText text={decision.summary} />
          {decision.hypothesis && (
            <p className="flow-hypothesis">待确认：{decision.hypothesis}</p>
          )}
          <small className="flow-evidence">
            依据：
            {decision.evidence
              .map(
                (e) =>
                  ({
                    code: "当前代码",
                    execution: "真实运行",
                    prediction: "你的预测",
                    answers: "作答记录",
                    retest: "复测结果",
                    history: "学习历史",
                  })[e] ?? e,
              )
              .join("、")}
          </small>
          {decision.nextLessonId && (
            <button
              className="flow-focus"
              disabled={flow.stale}
              onClick={() => onOpenLesson(decision.nextLessonId!)}
            >
              前往{findLesson(decision.nextLessonId)?.title ?? "建议课程"}
              <ArrowRight size={13} />
            </button>
          )}
          {decision.action === "continue" && (
            <a className="flow-focus" href="#progress">
              查看本次学习记录
              <ArrowRight size={13} />
            </a>
          )}
          {decision.focus && (
            <button
              className="flow-focus"
              disabled={flow.stale}
              onClick={() => onFocus(decision.focus!)}
            >
              <LocateFixed size={14} />
              {decision.focus.source === "execution"
                ? `查看执行第${decision.focus.step}步 · 第${decision.focus.line}行`
                : `查看课程演示第${decision.focus.step}步`}
            </button>
          )}
          {decision.question && (
            <form
              className="flow-answer"
              onSubmit={(e) => {
                e.preventDefault();
                void safe(async () => {
                  if (await flow.answer(answer)) setAnswer("");
                });
              }}
            >
              <label>
                {decision.question}
                <textarea
                  aria-label="回答AI追问"
                  value={answer}
                  maxLength={500}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="说说你的理解，也可以说明哪里不确定"
                />
              </label>
              <button
                disabled={!answer.trim() || flow.busy || saving || flow.stale}
              >
                提交理解
              </button>
            </form>
          )}
          {decision.sources.length > 0 && (
            <details className="flow-sources">
              <summary>参考课程 · {decision.sources.length}段</summary>
              {decision.sources.map((s) => (
                <section key={s.id}>
                  <b>{s.title}</b>
                  <p>{s.excerpt}</p>
                </section>
              ))}
            </details>
          )}
          {!task.attemptId && (
            <button
              className="flow-focus"
              disabled={flow.stale}
              onClick={onRun}
            >
              运行验证预测
              <ArrowRight size={13} />
            </button>
          )}
          {task.attemptId && task.practicePassed === false && (
            <button
              className="flow-focus"
              disabled={flow.stale}
              onClick={onEdit}
            >
              返回代码修正
              <ArrowRight size={13} />
            </button>
          )}
          {task.practicePassed &&
            !task.retest &&
            task.retestAvailable !== false && (
              <button
                className="flow-focus"
                disabled={flow.stale || saving}
                onClick={() => void safe(flow.startRetest)}
              >
                用新例子检查理解
                <ArrowRight size={13} />
              </button>
            )}
          {task.practicePassed &&
            !task.retest &&
            task.retestAvailable === false && (
              <p className="flow-note">
                本课现有独立复测已做过。可根据建议继续后续课程，不将重复作答当作新的理解证据。
              </p>
            )}
        </section>
      )}
      {task?.retest && (
        <section className="flow-retest">
          <h3>{task.retest.title}</h3>
          <p>{task.retest.prompt}</p>
          <pre>{task.retest.code}</pre>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (retestAnswer !== null)
                void safe(() => flow.submitRetest(retestAnswer));
            }}
          >
            {task.retest.options.map((option, i) => (
              <label key={`${task.retest!.id}:${i}`}>
                <input
                  type="radio"
                  name={`retest-${task.id}`}
                  checked={(retestAnswer ?? task.retestResult?.answer) === i}
                  onChange={() => setRetestAnswer(i)}
                  disabled={
                    flow.stale || flow.busy || !!task.retestResult?.correct
                  }
                />
                <code>{option}</code>
              </label>
            ))}
            {!task.retestResult?.correct && (
              <button
                disabled={
                  retestAnswer === null ||
                  saving ||
                  flow.stale ||
                  flow.busy ||
                  retestAnswer === task.retestResult?.answer
                }
              >
                {task.retestResult ? "提交订正" : "提交复测"}
              </button>
            )}
          </form>
          {task.retestResult && (
            <div
              className={
                task.retestResult.correct ? "flow-success" : "flow-stale"
              }
            >
              <b>
                {task.retestResult.correct
                  ? task.retestResult.assisted
                    ? "本题在AI讲解后通过，不计独立作答"
                    : task.retestResult.repeated
                      ? "这道题已做过，本次不计独立首次检验"
                      : task.retestResult.corrected
                        ? "本题已订正（参考过解析）"
                        : "这次迁移题通过"
                  : "这次还需复习，可以修改选项后订正"}
              </b>
              <p>{task.retestResult.explanation}</p>
            </div>
          )}
        </section>
      )}
      {task?.answers.length ? (
        <details className="flow-sources">
          <summary>本次追问记录 · {task.answers.length}条</summary>
          {task.answers.map((a, i) => (
            <section key={i}>
              <b>{a.question}</b>
              <p>{a.answer}</p>
            </section>
          ))}
        </details>
      ) : null}
      {!task && !flow.loading && (
        <p className="flow-note">
          保存预测或运行代码后，AI会结合真实证据发起分析。你也可以直接开始编写。
        </p>
      )}
    </div>
  );
}
