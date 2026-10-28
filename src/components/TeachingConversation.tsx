import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  LoaderCircle,
  LocateFixed,
  Send,
  Settings2,
  Square,
} from "lucide-react";
import type { Lesson } from "../../shared/curriculum";
import type { TeachingDecision, TeachingViewContext } from "../../shared/flow";
import { teachingPlan } from "../../shared/teaching";
import { lessonFoundation } from "../../shared/lessonFoundations";
import type { TeachingFlow } from "../hooks/useTeachingFlow";
import type { Missions } from "../hooks/useMissions";
import { useTeachingConversation } from "../hooks/useTeachingConversation";
import TeachingText from "./TeachingText";
import AIConnection from "./AIConnection";

export default function TeachingConversation({
  lesson,
  flow: f,
  missions: m,
  userId,
  onRun,
  onFocus,
  onHome,
  onRequireAuth,
  onFlush,
  courseReview,
  running = false,
  viewContext,
  onCompose,
}: {
  lesson: Lesson;
  flow: TeachingFlow;
  missions: Missions;
  userId?: string;
  onRun: () => void;
  onFocus: (focus: NonNullable<TeachingDecision["focus"]>) => void;
  onHome: () => void;
  onRequireAuth: () => void;
  onFlush: () => Promise<unknown>;
  courseReview: ReactNode;
  running?: boolean;
  viewContext?: TeachingViewContext;
  onCompose?: () => void;
}) {
  const history = useTeachingConversation(userId, lesson.id, f.task?.updatedAt),
    [text, setText] = useState(""),
    [asQuestion, setAsQuestion] = useState(false),
    [choice, setChoice] = useState<number | null>(null),
    [saving, setSaving] = useState(false),
    [localError, setLocalError] = useState(""),
    [settings, setSettings] = useState(false),
    bottom = useRef<HTMLDivElement>(null),
    scroll = useRef<HTMLDivElement>(null),
    nearBottom = useRef(true),
    manualScroll = useRef(false);
  const container = useRef<HTMLElement>(null),
    [mobileHeight, setMobileHeight] = useState<number>();
  useLayoutEffect(() => {
    const node = container.current;
    if (!node) return;
    const measure = () => {
      const top = node.getBoundingClientRect().top + window.scrollY;
      const height =
        window.innerWidth <= 760
          ? Math.max(320, Math.min(560, window.innerHeight - top - 16))
          : undefined;
      setMobileHeight((previous) => (previous === height ? previous : height));
    };
    measure();
    window.addEventListener("resize", measure);
    const observer = new ResizeObserver(measure);
    if (node.parentElement) observer.observe(node.parentElement);
    return () => {
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, [lesson.id]);
  const [pendingReply, setPendingReply] = useState<{
    text: string;
    kind: string;
    value: string;
  } | null>(null);
  const task = f.task,
    d = task?.decision,
    plan = teachingPlan(lesson),
    mission = m.active?.lessonId === lesson.id ? m.active : null;
  const canAdvance = !!mission && !!m.progress?.canAdvance && !f.stale;
  const advance = async () => {
    await onFlush();
    if (await m.advance()) onHome();
  };
  const predicting =
    !asQuestion &&
    !f.stale &&
    d?.responseMode === "prediction" &&
    !task?.attemptId;
  const reviewFallback =
    !!mission &&
    !!task?.practicePassed &&
    !!m.progress?.reviewFallback &&
    !m.progress?.canAdvance;
  const latestDecisionEvent = history.events
    .filter((e) => e.kind === "decision")
    .at(-1);
  const pendingDecision =
    d &&
    (!latestDecisionEvent ||
      latestDecisionEvent.taskId !== task?.id ||
      JSON.stringify(latestDecisionEvent.payload) !== JSON.stringify(d));
  useEffect(() => {
    setAsQuestion(false);
    setChoice(null);
  }, [task?.id, task?.retest?.id, d?.question]);
  useEffect(() => {
    const timeline = scroll.current;
    if (!timeline || !nearBottom.current) return;
    const replies = timeline.querySelectorAll<HTMLElement>(
      ":scope > .teacher-message",
    );
    const latest = replies[replies.length - 1];
    // New teaching starts at its first sentence; the outer editor never jumps.
    const top =
      !f.busy && !f.error && latest
        ? latest.getBoundingClientRect().top -
          timeline.getBoundingClientRect().top +
          timeline.scrollTop -
          12
        : timeline.scrollHeight;
    manualScroll.current = false;
    timeline.scrollTo({ top: Math.max(0, top), behavior: "auto" });
  }, [history.events.length, f.busy, task?.updatedAt]);
  useEffect(() => {
    if (
      pendingReply &&
      history.events.some(
        (e) =>
          ["prediction", "prediction_reply", "discussion", "answer"].includes(
            e.kind,
          ) &&
          String((e.payload as any)?.value ?? (e.payload as any)?.answer) ===
            pendingReply.value,
      )
    )
      setPendingReply(null);
  }, [history.events, pendingReply]);
  const safe = async (action: () => Promise<unknown>) => {
    onCompose?.();
    nearBottom.current = true;
    manualScroll.current = false;
    setSaving(true);
    setLocalError("");
    try {
      await action();
    } catch (e) {
      setLocalError((e as Error).message);
    } finally {
      setSaving(false);
      void history.refresh();
    }
  };
  const renderDecision = (decision: TeachingDecision, current: boolean) => (
    <>
      {decision.introduction && (
        <p className="teacher-purpose">
          <b>为什么学这一节</b>
          {decision.introduction.why}
        </p>
      )}
      <div className="teacher-prose">
        <TeachingText text={decision.summary} />
      </div>
      {decision.question && !decision.summary.includes(decision.question) && (
        <p className="teacher-question">{decision.question}</p>
      )}
      {decision.hypothesis && (
        <p className="teacher-hypothesis">待确认：{decision.hypothesis}</p>
      )}
      {current && decision.focus && !f.stale && (
        <button
          className="teacher-inline-action"
          onClick={() => onFocus(decision.focus!)}
        >
          <LocateFixed size={14} />
          {decision.focus.source === "execution"
            ? `看第${decision.focus.step}步的实际状态`
            : "打开对应动画"}
          <ArrowRight size={13} />
        </button>
      )}
      {!!decision.sources?.length && (
        <details className="teacher-sources">
          <summary>查看讲解依据 · {decision.sources.length}条</summary>
          {decision.sources.map((s) => (
            <p key={s.id}>
              <b>{s.title}</b> {s.excerpt}
            </p>
          ))}
        </details>
      )}
    </>
  );
  return (
    <section
      ref={container}
      style={mobileHeight ? { height: mobileHeight } : undefined}
      id="current-teaching-task"
      className="task-stage teaching-conversation"
      aria-label="AI教学对话"
    >
      <header className="teacher-header">
        <div>
          <img src="/brand/mark-gradient.png" alt="" />
          <span>
            <b>AI老师</b>
            <small>
              {!f.enabled
                ? "主动讲解已暂停"
                : f.busy
                  ? "正在思考这一步"
                  : running
                    ? "等待真实运行结果"
                    : d?.question
                      ? "先聊清楚，再动手"
                      : canAdvance
                        ? "已验证，仍可继续问"
                        : "一起读懂这段代码"}
            </small>
          </span>
        </div>
        <button
          aria-label="教学设置"
          aria-expanded={settings}
          onClick={() => setSettings(!settings)}
        >
          <Settings2 size={16} />
        </button>
      </header>
      {settings && (
        <div className="teacher-settings">
          <label>
            <input
              type="checkbox"
              checked={f.enabled}
              onChange={(e) => f.toggleEnabled(e.target.checked)}
            />
            打开课程和运行后主动讲解
          </label>
          <AIConnection
            userId={userId}
            onRequireAuth={onRequireAuth}
            onSaved={() => {
              f.setConfigured(true);
              void m.refresh();
            }}
          />
          <button onClick={() => void safe(() => f.enter())}>刷新对话</button>
          {!mission && (
            <button
              disabled={m.busy}
              onClick={() =>
                void safe(async () => {
                  await onFlush();
                  if (await m.adopt(lesson.id)) await f.enter();
                })
              }
            >
              设为当前学习课程
            </button>
          )}
        </div>
      )}
      <div
        className="teacher-timeline"
        ref={scroll}
        onWheel={() => {
          manualScroll.current = true;
        }}
        onTouchStart={() => {
          manualScroll.current = true;
        }}
        onPointerDown={() => {
          manualScroll.current = true;
        }}
        onKeyDown={(e) => {
          if (
            [
              "ArrowUp",
              "ArrowDown",
              "PageUp",
              "PageDown",
              "Home",
              "End",
            ].includes(e.key)
          )
            manualScroll.current = true;
        }}
        onScroll={() => {
          if (!manualScroll.current) return;
          const n = scroll.current;
          if (n)
            nearBottom.current =
              n.scrollHeight - n.scrollTop - n.clientHeight < 90;
        }}
      >
        <div className="teacher-course-marker">
          <BookOpen size={13} />
          {lesson.title}
        </div>
        {history.before && (
          <button
            className="teacher-earlier"
            onClick={() => {
              nearBottom.current = false;
              void history.earlier();
            }}
          >
            查看更早的教学对话
          </button>
        )}
        {(f.loading || m.loading) && (
          <div className="teacher-thinking" role="status">
            <LoaderCircle size={16} className="spin" />
            正在恢复这节课的对话…
          </div>
        )}
        {!f.loading && !f.configured && !history.events.length && (
          <article className="teacher-message course-note">
            <span>课程导读</span>
            <p>{lessonFoundation(lesson)}</p>
            <p>
              建议先了解：{plan.prerequisites.join("、")}
              。连接AI后，会结合你的代码逐步讲解和提问。
            </p>
            <button onClick={() => setSettings(true)}>连接AI老师</button>
          </article>
        )}
        {!f.loading && f.configured && !f.enabled && !history.events.length && (
          <article className="teacher-message course-note">
            <p>主动讲解已暂停。你可以先看动画、运行代码，或在这里提出问题。</p>
            <button
              onClick={() => {
                f.toggleEnabled(true);
              }}
            >
              让AI带我开始
            </button>
          </article>
        )}
        {history.events.map((event) => {
          const payload = event.payload as any,
            current =
              event.taskId === task?.id &&
              !f.stale &&
              (event.kind !== "decision" ||
                event.id === latestDecisionEvent?.id);
          if (event.kind === "decision")
            return (
              <article
                className={`teacher-message ${current ? "" : "earlier-version"}`}
                key={event.id}
              >
                <span>{current ? "AI老师" : "AI老师 · 较早讲解"}</span>
                {renderDecision(payload, current)}
              </article>
            );
          if (event.kind === "prediction" && payload.spoken)
            return (
              <article className="teacher-run-note" key={event.id}>
                <span>已记录的输出预期</span>
                <pre>{payload.value || "（无输出）"}</pre>
              </article>
            );
          if (
            ["answer", "discussion", "prediction_reply", "prediction"].includes(
              event.kind,
            )
          )
            return (
              <article className="student-message" key={event.id}>
                <span>{event.kind === "prediction" ? "我的预期" : "我"}</span>
                <p>
                  {event.kind === "prediction"
                    ? payload.value || "（无输出）"
                    : payload.answer}
                </p>
                {payload.viewContext && (
                  <small>
                    {payload.viewContext.kind === "lesson"
                      ? "课程动画"
                      : payload.viewContext.kind === "experiment"
                        ? "错误实验"
                        : "真实执行"}{" "}
                    · 第{payload.viewContext.stepIndex + 1}步
                  </small>
                )}
              </article>
            );
          if (event.kind === "experiment")
            return (
              <article className="teacher-run-note" key={event.id}>
                <span>
                  错误实验 ·{" "}
                  {payload.status === "success" ? "真实运行" : "本次遇到错误"}
                </span>
                <pre>
                  {String(payload.stdout || "（无标准输出）").slice(0, 240)}
                </pre>
              </article>
            );
          if (event.kind === "run")
            return (
              <article className="teacher-run-note" key={event.id}>
                <span>
                  {payload.result?.passed ? (
                    <Check size={13} />
                  ) : (
                    <ArrowRight size={13} />
                  )}
                  真实运行{payload.result?.passed ? " · 样例通过" : ""}
                </span>
                <pre>{payload.result?.stdout || "（无标准输出）"}</pre>
                {payload.comparison && (
                  <p>
                    预期 {payload.comparison.predicted || "无输出"} · 实际{" "}
                    {payload.comparison.actual ?? "暂不能核对"}
                  </p>
                )}
              </article>
            );
          if (event.kind === "retest")
            return (
              <article className="teacher-run-note" key={event.id}>
                <span>
                  {payload.correct
                    ? payload.corrected
                      ? "已订正 · 参考过解析"
                      : payload.assisted
                        ? "AI辅助后通过"
                        : payload.repeated
                          ? "重复例题回顾"
                          : "独立理解检验通过"
                    : "这次作答还需复核"}
                </span>
                <p>{payload.explanation}</p>
                {(payload.question ||
                  (event.taskId === task?.id && task?.retest)) && (
                  <details className="teacher-past-check">
                    <summary>查看当时的小例子</summary>
                    <p>{(payload.question ?? task?.retest).prompt}</p>
                    <pre>{(payload.question ?? task?.retest).code}</pre>
                  </details>
                )}
              </article>
            );
          return null;
        })}
        {pendingReply && (
          <article className="student-message">
            <span>我 · 正在发送</span>
            <p>{pendingReply.text}</p>
          </article>
        )}
        {pendingDecision && (
          <article className="teacher-message">
            <span>AI老师</span>
            {renderDecision(d, true)}
          </article>
        )}
        {task?.retest && !task.retestResult?.correct && !f.stale && (
          <article
            className="teacher-message teacher-check"
            id="current-migration-check"
          >
            <span>{task.retestCorrection ? "回到刚才的错题" : "换个小例子"}</span>
            {task.retestCorrection ? (
              <small>这道题以前答过，也看过解析。这次保留为订正和辅助作答，不算新的独立检验。</small>
            ) : task.retestAssisted && (
              <small>已接受AI讲解，这次按辅助作答记录。</small>
            )}
            <p>{task.retest.prompt}</p>
            <pre>{task.retest.code}</pre>
            <div className="teacher-answer-options">
              {task.retest.options.map((option, i) => (
                <button
                  key={i}
                  className={
                    (choice ?? task.retestResult?.answer) === i
                      ? "selected"
                      : ""
                  }
                  aria-pressed={(choice ?? task.retestResult?.answer) === i}
                  disabled={f.busy || saving || !!task.retestResult?.correct}
                  onClick={() => setChoice(i)}
                >
                  {option}
                </button>
              ))}
            </div>
            {!task.retestResult?.correct && (
              <button
                className="teacher-inline-action"
                disabled={
                  choice === null ||
                  saving ||
                  f.busy ||
                  choice === task.retestResult?.answer
                }
                onClick={() => void safe(() => f.submitRetest(choice!))}
              >
                {task.retestResult || task.retestCorrection ? "订正这个问题" : "回答这个问题"}
                <ArrowRight size={13} />
              </button>
            )}
            {task.retestResult && (
              <p>
                {task.retestResult.correct
                  ? task.retestResult.assisted
                    ? "这次在AI讲解后答对，按辅助作答记录。"
                    : task.retestResult.corrected
                      ? "已经订正，解析帮助过这次作答。"
                      : "这次独立作答正确。"
                  : "还不一致，可以参考说明后再试。"}{" "}
                {task.retestResult.explanation}
              </p>
            )}
          </article>
        )}
        {reviewFallback && !f.stale && (
          <article className="teacher-message teacher-check">
            <span>核对一下理解</span>
            {courseReview}
          </article>
        )}
        {canAdvance &&
          !f.busy &&
          !pendingReply &&
          task?.trigger !== "discussion" && (
            <article className="teacher-message teacher-complete">
              <p>这次运行和理解检查的记录已齐，可以继续下一项。</p>
              <button
                className="teacher-inline-action"
                disabled={m.busy || f.busy || saving}
                onClick={() => void safe(advance)}
              >
                {m.busy ? "AI正在安排…" : "让AI安排下一项"}
                <ArrowRight size={14} />
              </button>
            </article>
          )}
        {!mission &&
          task?.practicePassed &&
          !task.retest &&
          task.retestAvailable !== false &&
          !f.stale && (
            <button
              className="teacher-earlier"
              disabled={f.busy || saving}
              onClick={() => void safe(f.startRetest)}
            >
              换个例子再检查一下
            </button>
          )}
        {f.stale && (
          <p className="teacher-context-note">
            代码已修改。上面的分析对应修改前的版本，运行后会根据新结果继续。
          </p>
        )}
        {(f.busy || running) && (
          <div className="teacher-thinking" role="status">
            <i />
            <i />
            <i />
            {running
              ? "正在运行你的代码…"
              : !history.events.length
                ? "AI正在准备基础讲解…"
                : "AI正在对照这次的代码与记录…"}
          </div>
        )}
        {(localError || f.error || history.error || m.error) && (
          <div className="teacher-error" role="alert">
            {localError || f.error || history.error || m.error}
            <button
              disabled={f.busy || saving}
              onClick={() =>
                void safe(() =>
                  task?.attemptId && !f.stale ? f.retry() : f.enter(),
                )
              }
            >
              重试
            </button>
          </div>
        )}
        <div ref={bottom} />
      </div>
      <div className="teacher-composer">
        {predicting && (
          <div className="teacher-reply-mode">
            预测编辑器里的代码{" "}
            <button onClick={() => setAsQuestion(true)}>我想先提问</button>
          </div>
        )}
        {!predicting && d?.responseMode === "prediction" && asQuestion && (
          <div className="teacher-reply-mode">
            先说说哪里没懂{" "}
            <button onClick={() => setAsQuestion(false)}>回答输出预测</button>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (f.busy || saving || running || f.loading || m.loading) return;
            if (!userId) {
              onRequireAuth();
              return;
            }
            if (!text.trim()) return;
            const answer = text;
            setPendingReply({
              text: answer,
              kind: predicting ? "prediction_reply" : "discussion",
              value: answer,
            });
            setText("");
            void safe(async () => {
              try {
                if (predicting) {
                  if (!(await f.replyPrediction(answer))) {
                    setPendingReply(null);
                    setText(answer);
                  }
                } else if (!(await f.discuss(answer, viewContext))) {
                  setPendingReply(null);
                  setText(answer);
                }
              } catch (error) {
                setPendingReply(null);
                setText(answer);
                throw error;
              }
            });
          }}
        >
          <textarea
            onFocus={onCompose}
            aria-label="和AI老师对话"
            placeholder={
              predicting
                ? "你觉得“我的代码”会输出什么？"
                : "回答老师，或者说说哪里没懂…"
            }
            rows={2}
            maxLength={1000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          {f.busy ? (
            <button type="button" aria-label="停止AI讲解" onClick={f.stop}>
              <Square size={15} />
            </button>
          ) : (
            <button
              type="submit"
              aria-label="发送给AI老师"
              disabled={
                !text.trim() || saving || running || f.loading || m.loading
              }
            >
              <Send size={17} />
            </button>
          )}
        </form>
        <div className="teacher-quick-actions">
          <button
            disabled={saving || f.busy || running}
            onClick={() =>
              void safe(() =>
                f.discuss(
                  "先用简单的例子讲讲本节的基础知识，我还不太明白。",
                  viewContext,
                ),
              )
            }
          >
            先讲基础
          </button>
          <button
            disabled={
              running ||
              f.replyPending ||
              saving ||
              m.busy ||
              (canAdvance && f.busy)
            }
            onClick={canAdvance ? () => void safe(advance) : onRun}
          >
            {running
              ? "运行中…"
              : canAdvance
                ? m.busy
                  ? "AI正在安排…"
                  : "下一项学习"
                : task?.attemptId
                  ? "修改后再运行"
                  : "先运行看看"}
            <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </section>
  );
}
