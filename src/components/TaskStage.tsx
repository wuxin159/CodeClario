import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  LoaderCircle,
  LocateFixed,
  RotateCcw,
  X,
} from "lucide-react";
import type { TeachingFlow } from "../hooks/useTeachingFlow";
import type { TeachingDecision } from "../../shared/flow";
import type { Missions } from "../hooks/useMissions";
import TeachingText from "./TeachingText";
import AIConnection from "./AIConnection";
import { phaseNames } from "./TaskHome";

export default function TaskStage({
  flow: f,
  missions: m,
  lessonId,
  userId,
  onRun,
  onFocus,
  onHome,
  onRequireAuth,
  onFlush,
  courseReview,
}: {
  flow: TeachingFlow;
  missions: Missions;
  lessonId: string;
  userId?: string;
  onRun: () => void;
  onFocus: (focus: NonNullable<TeachingDecision["focus"]>) => void;
  onHome: () => void;
  onRequireAuth: () => void;
  onFlush: () => Promise<unknown>;
  courseReview: ReactNode;
}) {
  const [prediction, setPrediction] = useState(""),
    [kind, setKind] = useState<"output" | "variable" | "line">("output"),
    [target, setTarget] = useState(""),
    [answer, setAnswer] = useState(""),
    [choice, setChoice] = useState<number | null>(null),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const task = f.task,
    d = task?.decision,
    mission = m.active?.lessonId === lessonId ? m.active : null;
  const [editingPrediction, setEditingPrediction] = useState(false);
  useEffect(() => {
    if (task?.prediction) {
      setPrediction(task.prediction.value);
      setKind(task.prediction.kind);
      setTarget(task.prediction.target ?? "");
    }
  }, [task?.id]);
  const phase = mission
    ? (m.progress?.phase ?? "predict")
    : !task?.prediction
      ? "predict"
      : !task.attemptId
        ? "run"
        : !task.practicePassed
          ? "revise"
          : task.retestResult?.correct
            ? "ready"
            : "retest";
  useEffect(() => {
    setChoice(null);
  }, [task?.id, task?.retest?.id]);
  const safe = async (fn: () => Promise<unknown>) => {
    setSaving(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  if (f.loading || m.loading) {
    return (
      <section
        id="current-teaching-task"
        className="task-stage task-stage-loading"
        aria-label="当前教学任务"
        aria-busy="true"
      >
        <div role="status">
          <LoaderCircle className="spin" size={18} />
          <span>正在恢复学习任务…</span>
        </div>
        <div className="task-loading-lines" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </section>
    );
  }
  return (
    <section
      id="current-teaching-task"
      className="task-stage"
      aria-label="当前教学任务"
    >
      <header>
        <div>
          <small>当前阶段</small>
          <h2 key={phase}>
            {phase === "retest" && m.progress?.reviewFallback
              ? "课程理解检查"
              : phaseNames[phase]}
          </h2>
        </div>
        <span className="stage-source">
          {f.configured ? "AI引导" : "待连接"}
        </span>
      </header>
      {!mission && (
        <div className="adopt-task">
          <p>正在自主浏览课程。设为当前任务后，可在首页接着学。</p>
          <button
            disabled={m.busy}
            onClick={() => (userId ? void m.adopt(lessonId) : onRequireAuth())}
          >
            设为当前学习任务
            <ArrowRight size={14} />
          </button>
        </div>
      )}
      {f.stale && (
        <p className="task-warning">
          代码或输入已变化。当前诊断来自旧版本，重新运行后更新。
        </p>
      )}
      {f.loading && <p>正在恢复本次学习…</p>}
      {((!task?.prediction && !task?.attemptId) ||
        f.stale ||
        phase === "predict" ||
        editingPrediction) && (
        <form
          className="task-predict-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!userId) {
              onRequireAuth();
              return;
            }
            void safe(async () => {
              await f.predict({
                kind,
                value: prediction,
                ...(kind !== "output" ? { target } : {}),
              });
              setEditingPrediction(false);
            });
          }}
        >
          <h3>先想一想，再验证。</h3>
          <p>
            阅读当前代码，写下你认为会发生的结果。预测错误也是有用的学习线索。
          </p>
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
              placeholder={kind === "line" ? "例如：3" : "例如：total"}
              required
              maxLength={41}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          )}
          <textarea
            aria-label="我的运行预测"
            placeholder="写下你的预测，留空表示没有输出"
            maxLength={1000}
            value={prediction}
            onChange={(e) => setPrediction(e.target.value)}
          />
          <button className="button primary" disabled={saving || f.busy}>
            保存预测
            <ArrowRight size={14} />
          </button>
          <button type="button" className="stage-text-action" onClick={onRun}>
            还不确定，直接运行
          </button>
        </form>
      )}
      {task?.prediction &&
        !f.stale &&
        phase !== "predict" &&
        !editingPrediction && (
          <details className="task-saved-prediction">
            <summary>我的预测 · 已保存</summary>
            <pre>{task.prediction.value || "（无输出）"}</pre>
            <button
              onClick={() => setEditingPrediction(true)}
              disabled={f.busy || saving}
            >
              重新预测
            </button>
          </details>
        )}
      {task?.comparison && (
        <section
          className={
            "task-comparison " +
            (task.comparison.matches === false ? "has-difference" : "")
          }
        >
          <h3>
            {task.comparison.matches === false
              ? "预期和实际出现差异"
              : task.comparison.matches
                ? "这次预测与实际一致"
                : "这次预测暂不能核对"}
          </h3>
          <div>
            <span>我的预期</span>
            <pre>{task.comparison.predicted || "（无输出）"}</pre>
            <span>真实结果</span>
            <pre>{task.comparison.actual ?? "暂不可核对"}</pre>
          </div>
          {task.comparison.reason && <small>{task.comparison.reason}</small>}
        </section>
      )}
      {f.busy && (
        <div className="stage-analyzing" role="status">
          <LoaderCircle size={17} className="spin" />
          <span>AI正在分析本次练习，安排下一步…</span>
          <button aria-label="停止主动分析" onClick={f.stop}>
            <X size={14} />
          </button>
        </div>
      )}
      {(error || f.error) && (
        <p className="mission-error" role="alert">
          {error || f.error}
          <button disabled={f.busy || f.stale} onClick={() => void f.retry()}>
            重新分析
          </button>
        </p>
      )}
      {d && (
        <article
          className={"stage-decision " + (f.stale ? "is-stale" : "")}
          aria-label="AI教学建议"
        >
          <span className="stage-decision-label">
            AI选择 ·{" "}
            {
              {
                ask: "追问确认",
                explain: "针对性讲解",
                visualize: "观察引导",
                retest: "迁移复测",
                continue: "下一步建议",
              }[d.action]
            }
          </span>
          <h3>{d.title}</h3>
          <TeachingText text={d.summary} />
          {d.hypothesis && (
            <p className="stage-hypothesis">待确认：{d.hypothesis}</p>
          )}
          {d.focus && (
            <button
              className="stage-focus"
              disabled={f.stale}
              onClick={() => onFocus(d.focus!)}
            >
              <LocateFixed size={15} />
              {d.focus.source === "execution"
                ? `对照第${d.focus.step}步 · 第${d.focus.line}行`
                : `观察课程演示第${d.focus.step}步`}
              <ArrowRight size={14} />
            </button>
          )}
          {d.question &&
            !task.retest &&
            !(mission && m.progress?.reviewFallback && phase === "retest") && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void safe(async () => {
                    if (await f.answer(answer)) setAnswer("");
                  });
                }}
              >
                <label>
                  {d.question}
                  <textarea
                    aria-label="回答AI追问"
                    placeholder="说说你的理解，或哪里还不确定"
                    maxLength={500}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                  />
                </label>
                <button
                  className="button primary"
                  disabled={!answer.trim() || f.stale || f.busy || saving}
                >
                  提交理解
                  <ArrowRight size={14} />
                </button>
              </form>
            )}
          <details className="stage-sources">
            <summary>本次引导的依据 · {d.evidence.length}项</summary>
            <p>
              {d.evidence
                .map(
                  (e) =>
                    ({
                      code: "当前代码",
                      execution: "真实执行",
                      prediction: "你的预测",
                      answers: "作答记录",
                      retest: "复测结果",
                      history: "学习历史",
                    })[e] ?? e,
                )
                .join("、")}
            </p>
            {d.sources.map((s) => (
              <section key={s.id}>
                <b>{s.title}</b>
                <p>{s.excerpt}</p>
              </section>
            ))}
          </details>
        </article>
      )}
      {task && !task.attemptId && !f.stale && (
        <button
          className="button primary stage-run"
          disabled={saving}
          onClick={onRun}
        >
          运行，核对我的预期
          <ArrowRight size={15} />
        </button>
      )}
      {task?.practicePassed &&
        !task.retest &&
        !f.stale &&
        task.retestAvailable !== false && (
          <button
            className="button primary stage-run"
            disabled={f.busy || saving}
            onClick={() => void safe(f.startRetest)}
          >
            用新例子检查理解
            <ArrowRight size={15} />
          </button>
        )}
      {mission &&
        task?.practicePassed &&
        !f.stale &&
        m.progress?.reviewFallback && (
          <div className="task-course-review">
            <p>本课使用审校的课程理解题核对，不计为新生成的独立复测。</p>
            {courseReview}
          </div>
        )}
      {mission && m.progress?.verification === "previous" && (
        <p className="task-warning">
          本课现有复测已做过。这次保存新的运行结果，历史题不计为新的独立检验。
        </p>
      )}
      {task?.retest && (
        <section className="task-retest" id="current-migration-check">
          <small>迁移检验 · 不修改原课程代码</small>
          <h3>{task.retest.title}</h3>
          <p>{task.retest.prompt}</p>
          <pre>{task.retest.code}</pre>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (choice !== null) void safe(() => f.submitRetest(choice));
            }}
          >
            {task.retest.options.map((o, i) => (
              <label key={i}>
                <input
                  type="radio"
                  name={"mission-retest-" + task.id}
                  checked={(choice ?? task.retestResult?.answer) === i}
                  disabled={f.stale || f.busy || !!task.retestResult?.correct}
                  onChange={() => setChoice(i)}
                />
                <code>{o}</code>
              </label>
            ))}
            {!task.retestResult?.correct && (
              <button
                className="button primary"
                disabled={
                  choice === null ||
                  saving ||
                  f.busy ||
                  f.stale ||
                  choice === task.retestResult?.answer
                }
              >
                {task.retestResult ? "提交订正" : "提交复测"}
              </button>
            )}
          </form>
          {task.retestResult && (
            <div className="task-retest-result">
              <b>
                {task.retestResult.correct
                  ? task.retestResult.repeated
                    ? "重复题通过，不计首次独立检验"
                    : task.retestResult.corrected
                      ? "已订正 · 参考过解析"
                      : "本次独立检验通过"
                  : "还需复习 · 可以订正"}
              </b>
              <p>{task.retestResult.explanation}</p>
            </div>
          )}
        </section>
      )}
      {mission && m.progress?.canAdvance && !f.stale && (
        <section className="task-complete">
          <Check size={22} />
          <h3>
            {m.progress.verification === "corrected"
              ? "本次已订正，可继续巩固"
              : "本次练习已完成验证"}
          </h3>
          <p>让AI结合这次记录，选择复习或下一项任务。</p>
          <button
            className="button primary"
            disabled={m.busy || f.busy || saving}
            onClick={() =>
              void safe(async () => {
                await onFlush();
                const next = await m.advance();
                if (next) onHome();
              })
            }
          >
            {m.busy ? "AI正在安排下一项…" : "完成任务，AI安排下一项"}
            <ArrowRight size={15} />
          </button>
        </section>
      )}
      {m.error && (
        <p role="alert" className="mission-error">
          {m.error}
        </p>
      )}
      <details className="stage-controls">
        <summary>学习选项</summary>
        <label>
          <input
            type="checkbox"
            checked={f.enabled}
            onChange={(e) => f.toggleEnabled(e.target.checked)}
          />
          根据作答和运行主动分析
        </label>
        <button
          disabled={!userId || f.busy || f.stale}
          onClick={() => void f.retry()}
        >
          <RotateCcw size={13} />
          分析这次练习的记录
        </button>
        <AIConnection
          userId={userId}
          onRequireAuth={onRequireAuth}
          onSaved={() => {
            f.setConfigured(true);
            void m.refresh();
          }}
        />
      </details>
    </section>
  );
}
