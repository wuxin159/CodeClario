import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  Lightbulb,
  LoaderCircle,
  MessageCircle,
  Play,
  RotateCcw,
  Send,
  X,
} from "lucide-react";
import {
  lessons,
  equivalentLesson,
  type Language,
  languages,
  type Lesson,
  type RunResult,
} from "../../shared/curriculum";
import {
  buildScene,
  defaultSceneOptions,
  type SceneOptions,
} from "../../shared/scenes";
import {
  teachingPlan,
  studyStatus,
  type StudyRecord,
  type StudyEvent,
} from "../../shared/teaching";
import { apiRequest } from "../hooks/useLearningAccount";
import LessonVisualization from "./LessonVisualization";
import UnderstandingQuestion from "./UnderstandingQuestion";
import TeachingText from "./TeachingText";
import ExecutionReplay from "./ExecutionReplay";
import { useTeachingFlow } from "../hooks/useTeachingFlow";
import TeachingConversation from "./TeachingConversation";
import LiveEvidence from "./LiveEvidence";
import ErrorLab from "./ErrorLab";
import type { TeachingViewContext } from "../../shared/flow";
import { lessonIntroduction } from "../../shared/lessonIntroduction";
import type { Missions } from "../hooks/useMissions";
import { executionInterruption } from "../../shared/executionFailure";

import CodeEditor from "./RecoverableEditor";
const runStatusLabel: Record<string, string> = {
  success: "执行结束",
  compile_error: "编译错误",
  compile_timeout: "编译超时",
  compile_terminated: "编译被终止",
  runtime_error: "运行错误",
  timeout: "运行超时",
  error: "执行失败",
};
type Focus = {
  sceneId: string;
  stepId: string;
  options: SceneOptions;
  label: string;
};
type Message = {
  role: "user" | "assistant";
  content: string;
  provider?: string;
  tools?: string[];
  skill?: string;
  context?: { revision?: string; focus?: Focus; focuses?: Focus[] };
};
type Props = {
  missions: Missions;
  onHome: () => void;
  onFlush: () => Promise<unknown>;
  lesson: Lesson;
  draft: string;
  savedInput: string;
  onDraft: (code: string) => void;
  onInput: (input: string) => void;
  onOpen: (id: string) => void;
  onBack: () => void;
  onRun: (r: RunResult) => void;
  completed: string[];
  status: { runner: boolean; ai: boolean; checked: boolean };
  notify: (v: string) => void;
  userId?: string;
  onRequireAuth: () => void;
  saveStatus: "saved" | "saving" | "error" | "guest";
  onSaveRetry: () => void;
  study?: StudyRecord;
  onStudyChange: () => void;
};

export default function LearningWorkspace(p: Props) {
  const { lesson, draft, savedInput, userId, status, notify } = p;
  const plan = teachingPlan(lesson);
  const languageLessons = lessons.filter((l) => l.language === lesson.language);
  const positionInCourse = languageLessons.findIndex((l) => l.id === lesson.id);
  const [pane, setPane] = useState<"lesson" | "visual" | "code" | "coach">(
    "code",
  );
  const [mode, setMode] = useState<"visual" | "code" | "replay" | "experiment">(
    "code",
  );
  const [experimentView, setExperimentView] = useState<TeachingViewContext>();
  const experimentRun = useRef<{ run: () => void }>(null);
  const [experimentOpened, setExperimentOpened] = useState(false);
  // 实验首次打开后只隐藏而不卸载，保证同课程页签来回切换时未运行的改稿仍在。
  useEffect(() => {
    if (mode === "experiment") setExperimentOpened(true);
  }, [mode]);
  const [coachTab, setCoachTab] = useState<"flow" | "chat">("flow");
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [observedLine, setObservedLine] = useState(0);
  const [observedIndex, setObservedIndex] = useState(0),
    [replayIndex, setReplayIndex] = useState(0);
  useEffect(() => {
    const closeTools = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setResourcesOpen(false);
        setChatOpen(false);
      }
    };
    window.addEventListener("keydown", closeTools);
    return () => window.removeEventListener("keydown", closeTools);
  }, []);
  const [replayFocus, setReplayFocus] = useState<{
    step: number;
    nonce: number;
    variable?: string;
  }>();
  const flow = useTeachingFlow({
    userId,
    lessonId: lesson.id,
    code: draft,
    stdin: savedInput,
  });
  const activeMission =
    p.missions.active?.lessonId === lesson.id ? p.missions.active : null;
  useEffect(() => {
    void p.missions.refresh();
  }, [flow.task?.updatedAt]);
  const initialAnalysis = useRef(false);
  useEffect(() => {
    if (
      !flow.loading &&
      !p.missions.loading &&
      userId &&
      !initialAnalysis.current &&
      flow.configured &&
      flow.enabled
    ) {
      initialAnalysis.current = true;
      void flow.enter();
    }
  }, [
    flow.loading,
    flow.configured,
    flow.enabled,
    p.missions.loading,
    activeMission?.id,
  ]);
  function focusEvidence(
    focus: NonNullable<import("../../shared/flow").TeachingDecision["focus"]>,
  ) {
    if (focus.source === "execution") {
      setReplayFocus({
        step: focus.step!,
        variable: focus.variable,
        nonce: Date.now(),
      });
      setMode("replay");
      setPane("visual");
    } else {
      const focusedOptions = focus.options ?? defaultSceneOptions(lesson);
      const freshScene = buildScene(lesson, focusedOptions);
      const target = freshScene.steps[(focus.step ?? 0) - 1];
      if (
        !target ||
        (focus.line && focus.line !== target.line) ||
        (focus.sceneId && focus.sceneId !== freshScene.id)
      ) {
        notify("这条标注来自旧版课程演示，请重新分析后再查看。");
        return;
      }
      setOptions(focusedOptions);
      setPosition(focus.step! - 1);
      setVisualFocus((v) => v + 1);
      setMode("visual");
      setPane("visual");
    }
    requestAnimationFrame(() =>
      document
        .getElementById("task-workbench")
        ?.scrollIntoView({ block: "start", behavior: "smooth" }),
    );
  }
  const [options, setOptions] = useState(defaultSceneOptions(lesson));
  const [position, setPosition] = useState(0);
  const [visualFocus, setVisualFocus] = useState(0);
  const scene = useMemo(
    () => buildScene(lesson, options),
    [lesson.id, options],
  );
  const [study, setStudy] = useState<StudyRecord>(p.study ?? {});
  const [result, setResult] = useState<RunResult | null>(null);
  const [runCode, setRunCode] = useState("");
  const [runInput, setRunInput] = useState("");
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [consoleTab, setConsoleTab] = useState<"output" | "tests" | "input">(
    "output",
  );
  const [solution, setSolution] = useState(false);
  const [reset, setReset] = useState(false);
  const [menu, setMenu] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [historyReady, setHistoryReady] = useState(!userId);
  const [historyError, setHistoryError] = useState("");
  const [reloadChats, setReloadChats] = useState(0);
  const [question, setQuestion] = useState("");
  const [thinking, setThinking] = useState(false);
  const [level, setLevel] = useState(1);
  const [revision, setRevision] = useState("");
  const runController = useRef<AbortController | null>(null);
  const coachController = useRef<AbortController | null>(null);
  const live = useRef(true);
  const chatEnd = useRef<HTMLDivElement>(null);
  const reviewTarget = useRef<HTMLDivElement>(null);
  const [reviewRequest, setReviewRequest] = useState(0);
  const [extraPracticeOpen, setExtraPracticeOpen] = useState(false),
    reviewHandled = useRef(0);
  useEffect(() => {
    if (!reviewRequest || reviewHandled.current === reviewRequest) return;
    if (!extraPracticeOpen) {
      setExtraPracticeOpen(true);
      return;
    }
    reviewTarget.current?.scrollIntoView({
      block: "start",
      behavior: "smooth",
    });
    reviewTarget.current
      ?.querySelector<HTMLInputElement>("input")
      ?.focus({ preventScroll: true });
    reviewHandled.current = reviewRequest;
  }, [reviewRequest, extraPracticeOpen]);
  const stale = !!result && (draft !== runCode || savedInput !== runInput);
  const activeAIFocus =
    !flow.stale &&
    flow.task?.decision?.focus?.source === "execution" &&
    flow.task.attemptId === result?.id
      ? flow.task.decision.focus
      : undefined;
  useEffect(() => {
    if (activeAIFocus?.step)
      setReplayFocus({
        step: activeAIFocus.step,
        variable: activeAIFocus.variable,
        nonce: Date.now(),
      });
    if (
      mode !== "experiment" &&
      activeAIFocus?.step &&
      flow.task?.decision?.action === "visualize"
    ) {
      setMode("replay");
      setPane("visual");
    }
    const chosen = flow.task?.decision;
    if (
      mode !== "experiment" &&
      !flow.stale &&
      chosen?.action === "visualize" &&
      chosen.focus?.source === "lesson"
    )
      focusEvidence(chosen.focus);
  }, [flow.task?.decision, flow.stale, result?.id]);
  useEffect(() => {
    const task = flow.task;
    if (!task?.attemptId || result || !userId) return;
    const controller = new AbortController();
    fetch(`/api/learning/attempts/${task.attemptId}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (!controller.signal.aborted && data.result) {
          setResult(data.result);
          setRunCode(data.code);
          setRunInput(data.stdin);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [flow.task?.id, userId]);
  useEffect(() => {
    setStudy(p.study ?? {});
  }, [p.study]);
  useEffect(() => {
    let valid = true;
    crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(draft + "\0" + savedInput))
      .then((buffer) => {
        if (valid)
          setRevision(
            Array.from(new Uint8Array(buffer))
              .map((x) => x.toString(16).padStart(2, "0"))
              .join("")
              .slice(0, 16),
          );
      });
    return () => {
      valid = false;
    };
  }, [draft, savedInput]);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      runController.current?.abort();
      coachController.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    apiRequest("/api/learning/events", {
      userId,
      lessonId: lesson.id,
      kind: "visited",
    })
      .then((r) => {
        if (mounted) {
          setStudy(r.study);
          p.onStudyChange();
        }
      })
      .catch((e) => {
        if (mounted) notify(e.message);
      });
    return () => {
      mounted = false;
    };
  }, [userId, lesson.id]);
  useEffect(() => {
    if (!userId) {
      setHistoryReady(true);
      return;
    }
    const controller = new AbortController();
    setHistoryReady(false);
    setHistoryError("");
    fetch(`/api/learning/messages/${lesson.id}`, { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || data.userId !== userId)
          throw new Error(data.error || "对话加载失败。");
        setMessages(data.messages);
        setHistoryReady(true);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setHistoryError(e.message);
      });
    return () => controller.abort();
  }, [userId, lesson.id, reloadChats]);
  useEffect(() => {
    if (messages.length || thinking)
      chatEnd.current?.scrollIntoView({ block: "nearest" });
  }, [messages, thinking]);
  const changeOptions = (next: SceneOptions) => {
    setOptions(next);
    setPosition(0);
  };
  async function submitQuestion(kind: "prediction" | "review", answer: number) {
    if (!userId) {
      p.onRequireAuth();
      return;
    }
    const data = await apiRequest("/api/learning/events", {
      userId,
      lessonId: lesson.id,
      kind,
      answer,
    } satisfies StudyEvent & { userId: string });
    if (!live.current) return;
    setStudy(data.study);
    void p.missions.refresh();
    p.onStudyChange();
    void flow.onStudy();
  }
  async function run(showAnimation = false) {
    if (running || flow.replyPending) return;
    if (!userId) {
      p.onRequireAuth();
      return;
    }
    const code = draft,
      stdin = savedInput;
    setMode("code");
    setPane("code");
    setRunning(true);
    setRunError("");
    setConsoleTab("output");
    const controller = new AbortController();
    runController.current = controller;
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, lessonId: lesson.id, code, stdin }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (controller.signal.aborted) return;
      setResult(data);
      setRunCode(code);
      setRunInput(stdin);
      if (showAnimation && data.trace?.status === "available") {
        setMode("replay");
        setPane("visual");
      }
      p.onRun(data);
      void flow
        .afterRun(data, code, stdin)
        .catch((e) => flow.setError(e.message));
      if (data.passed) {
        setConsoleTab("tests");
        notify("样例通过。接着完成本次理解检验。");
      }
    } catch (e) {
      if (!controller.signal.aborted) setRunError((e as Error).message);
    } finally {
      if (live.current) setRunning(false);
    }
  }
  async function ask(text: string, skill = "hint") {
    if (thinking || !historyReady || !text.trim()) return;
    if (!userId) {
      p.onRequireAuth();
      return;
    }
    const controller = new AbortController();
    coachController.current = controller;
    setThinking(true);
    setQuestion("");
    setMessages((v) => [...v, { role: "user", content: text }]);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          lessonId: lesson.id,
          code: draft,
          stdin: savedInput,
          question: text,
          skill,
          level,
          attemptId: !stale ? result?.id : undefined,
          visual: {
            version: plan.version,
            options,
            stepIndex: position,
            sceneId: scene.id,
          },
        }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (controller.signal.aborted) return;
      setMessages((v) => [...v, { role: "assistant", ...data }]);
      p.onStudyChange();
    } catch (e) {
      if (!controller.signal.aborted)
        setMessages((v) => [
          ...v,
          {
            role: "assistant",
            content: (e as Error).message,
            provider: "error",
          },
        ]);
    } finally {
      if (coachController.current === controller && live.current)
        setThinking(false);
    }
  }
  return (
    <main className="learning-workspace" data-mode={mode} onKeyDownCapture={(event) => {
      // 在编辑器默认键位之前消费快捷键，并按当前模式分派，防止插空行或运行错代码。
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        if (mode === "experiment") experimentRun.current?.run();
        else void run();
      }
    }}>
      <div className="learning-toolbar">
        <button
          className="workspace-back"
          aria-label="返回课程目录"
          onClick={p.onBack}
        >
          <ArrowLeft size={16} />
          <span>课程目录</span>
        </button>
        <div className="learning-lesson-menu">
          <button onClick={() => setMenu((v) => !v)}>
            {lesson.title}
            <ChevronDown size={15} />
          </button>
          {menu && (
            <div className="lesson-menu">
              {languageLessons.map((l, i) => (
                <button key={l.id} onClick={() => p.onOpen(l.id)}>
                  <span>{i + 1}</span>
                  {l.title}
                  {p.completed.includes(l.id) && <Check size={13} />}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="learning-position">
          {positionInCourse + 1} / {languageLessons.length}
        </span>
        <div className="learning-toolbar-end">
          <button className="workspace-tool" onClick={p.onHome}>
            我的学习
          </button>
          <button
            className="workspace-tool"
            aria-expanded={resourcesOpen}
            onClick={() => setResourcesOpen(!resourcesOpen)}
          >
            课程资料
          </button>
          {messages.length > 0 && (
            <button
              className="workspace-tool"
              aria-expanded={chatOpen}
              onClick={() => {
                setChatOpen(!chatOpen);
                setCoachTab("chat");
              }}
            >
              历史提问
            </button>
          )}
          {p.saveStatus === "error" || p.saveStatus === "guest" ? (
            <button
              className={`study-save ${p.saveStatus}`}
              onClick={p.onSaveRetry}
            >
              {p.saveStatus === "error" ? "保存失败 · 重试" : "登录后保存"}
            </button>
          ) : (
            <span className="study-save" role="status">
              {mode === "experiment" ? "主代码" : ""}{p.saveStatus === "saved" ? "已保存" : "保存中…"}
            </span>
          )}
          <select
            aria-label="切换编程语言"
            value={lesson.language}
            onChange={(e) => {
              const language = e.target.value as Language;
              const equivalent = equivalentLesson(lesson, language);
              if (!equivalent)
                notify("目标语言暂无对应知识点，已打开该语言的第一课。");
              p.onOpen(equivalent?.id ?? `${language}-1`);
            }}
          >
            {languages.map((l) => (
              <option value={l.id} key={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <header className="mission-workspace-header">
        <div>
          <small>
            {p.missions.loading
              ? "正在恢复学习任务"
              : activeMission?.source === "deepseek"
                ? "AI安排的学习任务"
                : activeMission
                  ? "自主选择的学习任务"
                  : "课程预览"}
          </small>
          <h1>{activeMission?.title ?? lesson.title}</h1>
          <p>{lesson.task}</p>
        </div>
      </header>
      <nav className="task-mobile-navigation" aria-label="任务工作区域">
        <button
          onClick={() =>
            document
              .getElementById("current-teaching-task")
              ?.scrollIntoView({ block: "start" })
          }
        >
          AI老师{flow.busy ? " · 讲解中" : ""}
        </button>
        <button
          onClick={() =>
            document
              .getElementById("task-workbench")
              ?.scrollIntoView({ block: "start" })
          }
        >
          代码与执行观察
        </button>
        <button onClick={() => setResourcesOpen(true)}>课程资料</button>
      </nav>
      <div className={`learning-grid work-mode-${mode}`}>
        <TeachingConversation
          lesson={lesson}
          running={running}
          onCompose={() => setVisualFocus((v) => v + 1)}
          viewContext={
            mode === "experiment"
              ? experimentView
              : mode === "visual"
                ? {
                    kind: "lesson",
                    sceneId: scene.id,
                    options,
                    stepIndex: position,
                  }
                : !stale && result?.trace?.steps?.length
                  ? {
                      kind: "execution",
                      attemptId: result.id,
                      stepIndex:
                        mode === "replay" ? replayIndex : observedIndex,
                    }
                  : undefined
          }
          flow={flow}
          missions={p.missions}
          userId={userId}
          onRun={() => void run()}
          onFocus={focusEvidence}
          onHome={p.onHome}
          onRequireAuth={p.onRequireAuth}
          onFlush={p.onFlush}
          courseReview={
            <>
              <details className="course-review-example" open>
                <summary>本题使用的课程示例</summary>
                <small>课程模型，与当前编辑器程序分别记录。</small>
                <pre>{scene.code}</pre>
              </details>
              <UnderstandingQuestion
                key={activeMission?.id ?? "course"}
                question={plan.questions[1]}
                record={
                  activeMission && p.missions.progress?.reviewFallback
                    ? { review: p.missions.progress.courseReview }
                    : study
                }
                onSubmit={submitQuestion}
              />
            </>
          }
        />
        <aside
          className={`study-lesson resource-drawer ${resourcesOpen ? "drawer-open" : ""}`}
        >
          <button
            className="drawer-close"
            onClick={() => setResourcesOpen(false)}
          >
            关闭课程资料 <X size={16} />
          </button>
          <div className="study-eyebrow">
            {plan.chapter} / 第{positionInCourse + 1}节
          </div>
          <h1>{lesson.title}</h1>
          <p className="study-subtitle">{lesson.subtitle}</p>
          <div className="study-state-label">
            {studyStatus(study)}
            {p.completed.includes(lesson.id) && " · 练习通过"}
          </div>
          <section className="learning-goals">
            <h2>为什么学这一节</h2>
            <p>{lessonIntroduction(lesson).why}</p>
            <h2>本节目标</h2>
            <ul>
              {plan.goals.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
            <small>建议基础：{plan.prerequisites.join("、")}</small>
          </section>
          <div className="reading-sections">
            {plan.sections.map((s, i) => (
              <details key={s.title} open={i === 0 || undefined}>
                <summary>{s.title}</summary>
                <p>{s.text}</p>
              </details>
            ))}
          </div>
          <div className="study-task">
            <span>
              <Code2 size={15} />
              本节编码任务
            </span>
            <p>{lesson.task}</p>
            <small>预期输出</small>
            <pre>{lesson.expected}</pre>
            <button
              onClick={() => {
                setMode("code");
                setPane("code");
                setResourcesOpen(false);
                document
                  .getElementById("task-workbench")
                  ?.scrollIntoView({ block: "start" });
              }}
            >
              打开我的代码
              <ArrowRight size={14} />
            </button>
          </div>
          <UnderstandingQuestion
            question={plan.questions[0]}
            record={study}
            onSubmit={submitQuestion}
          />
          <button
            className="study-solution-button"
            onClick={() => setSolution((v) => !v)}
          >
            {solution ? "收起参考解析" : "查看参考解析"}
            <ChevronDown size={14} />
          </button>
          {solution && (
            <div className="study-solution">
              <p>{lesson.hints[2]}</p>
              <pre>{lesson.solution}</pre>
              <p>{plan.takeaway}</p>
              <button
                onClick={() => {
                  p.onDraft(lesson.solution);
                  setMode("code");
                  setPane("code");
                  setResourcesOpen(false);
                  notify("已放入参考代码，请运行并尝试理解检查。");
                }}
              >
                <Copy size={13} />
                放入编辑器
              </button>
            </div>
          )}
          <div className="study-lesson-navigation">
            <button
              disabled={positionInCourse === 0}
              onClick={() => p.onOpen(languageLessons[positionInCourse - 1].id)}
            >
              <ChevronLeft size={15} />
              上一节
            </button>
            <button
              disabled={positionInCourse === languageLessons.length - 1}
              onClick={() => p.onOpen(languageLessons[positionInCourse + 1].id)}
            >
              下一节
              <ChevronRight size={15} />
            </button>
          </div>
        </aside>
        <section
          id="task-workbench"
          className={`study-center ${pane === "visual" || pane === "code" ? "mobile-active" : ""}`}
        >
          <div className="study-mode-tabs">
            <button
              className={mode === "visual" ? "selected" : ""}
              onClick={() => {
                setMode("visual");
                setPane("visual");
              }}
            >
              <Play size={15} />
              课程演示
            </button>
            <button
              className={mode === "code" ? "selected" : ""}
              onClick={() => {
                setMode("code");
                setPane("code");
              }}
            >
              <Code2 size={15} />
              我的代码
            </button>
            <button
              className={mode === "replay" ? "selected" : ""}
              onClick={() => {
                setMode("replay");
                setPane("visual");
              }}
            >
              我的代码动画
            </button>
            <button
              className={mode === "experiment" ? "selected" : ""}
              onClick={() => {
                setMode("experiment");
                setPane("visual");
              }}
            >
              错误实验
            </button>
            <span>
              {mode === "visual"
                ? "课程模型"
                : mode === "replay"
                  ? "实测轨迹"
                  : mode === "experiment"
                    ? "单独保存，不计课程成绩"
                    : "真实编译运行"}
            </span>
          </div>
          <div className="study-center-body" hidden={mode !== "visual"}>
            <LessonVisualization
              lesson={lesson}
              scene={scene}
              options={options}
              onOptions={changeOptions}
              position={position}
              onPosition={setPosition}
              playbackContext={`${pane}:${mode}:${visualFocus}:${thinking}:${flow.busy}`}
            />
            <details
              className="optional-course-check"
              open={extraPracticeOpen}
              onToggle={(e) => setExtraPracticeOpen(e.currentTarget.open)}
            >
              <summary>课程自测（可选）</summary>
              <div ref={reviewTarget} className="study-understanding">
                <UnderstandingQuestion
                  question={plan.questions[1]}
                  record={study}
                  onSubmit={submitQuestion}
                />
              </div>
            </details>
            <div className="study-next-action">
              <BookOpen size={19} />
              <p>
                理解示例后，回到自己的代码修正问题。演示、样例通过和理解检查分别记录。
              </p>
              <button
                onClick={() => {
                  setMode("code");
                  setPane("code");
                }}
              >
                编写与验证
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
          {mode === "replay" && (
            <ExecutionReplay
              result={result}
              code={runCode}
              stale={stale}
              focus={replayFocus}
              context={`${pane}:${mode}:${flow.busy}:${visualFocus}`}
              onViewedStep={setReplayIndex}
            />
          )}
          {(mode === "experiment" || experimentOpened) && (
            <div hidden={mode !== "experiment"}>
            <ErrorLab
              active={mode === "experiment"}
              runRef={experimentRun}
              lesson={lesson}
              userId={userId}
              context={`${mode}:${visualFocus}`}
              onContext={setExperimentView}
              onAnalyze={(v) => {
                void flow.observeExperiment(v);
              }}
            />
            </div>
          )}
          <div className="study-code-body" hidden={mode !== "code"}>
            <div className="study-editor-caption">
              <code>
                main.{lesson.language === "python" ? "py" : lesson.language} ·{" "}
                {lesson.language === "python"
                  ? "Python 3"
                  : lesson.language === "cpp"
                    ? "C++17"
                    : "C17"}
              </code>
              <button aria-label="重置代码" onClick={() => setReset(true)}>
                <RotateCcw size={15} />
              </button>
            </div>
            <div className="task-code-observe">
              <div className="study-code-editor">
                  <CodeEditor
                    value={draft}
                    onChange={p.onDraft}
                    language={lesson.language}
                    highlightLine={
                      activeAIFocus?.line ?? (!stale ? observedLine : undefined)
                    }
                  />
              </div>
              <LiveEvidence
                result={result}
                stale={stale}
                focus={replayFocus}
                onStep={setObservedLine}
                onViewedStep={setObservedIndex}
              />
            </div>
            {activeAIFocus && (
              <div className="code-ai-annotation">
                <span>
                  {flow.task?.decision?.action === "retest"
                    ? "迁移检验"
                    : `AI定位 · 第${activeAIFocus.line}行`}
                </span>
                <p>
                  {flow.task?.decision?.action === "retest"
                    ? "本次代码已通过，请在当前教学任务中查看新题并独立作答。"
                    : `第${activeAIFocus.step}步的变量与输出已定位到执行观察。`}
                </p>
                <button
                  onClick={() => {
                    if (flow.task?.decision?.action === "retest") {
                      document
                        .getElementById("current-migration-check")
                        ?.scrollIntoView({
                          block: "center",
                          behavior: window.matchMedia(
                            "(prefers-reduced-motion: reduce)",
                          ).matches
                            ? "auto"
                            : "smooth",
                        });
                      return;
                    }
                    setMode("replay");
                    setPane("visual");
                  }}
                >
                  {flow.task?.decision?.action === "retest"
                    ? "查看检验"
                    : "对照真实状态"}
                  <ArrowRight size={13} />
                </button>
              </div>
            )}
            <div className="study-run-bar">
              <span>
                {!status.checked
                  ? "正在检查运行环境"
                  : status.runner
                    ? "运行环境已就绪"
                    : "运行服务未就绪"}{" "}
                · Ctrl + Enter
              </span>
              <button
                className="code-animation-run"
                disabled={running || flow.replyPending}
                onClick={() => void run(true)}
              >
                运行并看动画
              </button>
              <button
                disabled={running || flow.replyPending}
                onClick={() => void run()}
              >
                {running ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <Play size={16} />
                )}
                {running
                  ? "运行中…"
                  : flow.replyPending
                    ? "正在记录回答…"
                    : "运行代码"}
              </button>
            </div>
            {stale && (
              <p className="result-stale">
                代码或输入已修改，下方结果来自旧版本。请重新运行。
              </p>
            )}
            {runError && (
              <p className="study-error" role="alert">
                {runError}
              </p>
            )}
            <div className="study-console">
              <div className="study-console-tabs">
                {(
                  [
                    { id: "output", title: "运行结果" },
                    { id: "tests", title: "样例检查" },
                    { id: "input", title: "标准输入" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    className={consoleTab === t.id ? "selected" : ""}
                    onClick={() => setConsoleTab(t.id)}
                  >
                    {t.title}
                  </button>
                ))}
                {result && (
                  <button
                    onClick={() => {
                      setMode("replay");
                      setPane("visual");
                    }}
                  >
                    查看执行回放
                  </button>
                )}
              </div>
              {consoleTab === "input" ? (
                <label className="study-stdin">
                  <span>运行前一次性填写，程序按需读取。</span>
                  <textarea
                    aria-label="标准输入"
                    maxLength={4000}
                    value={savedInput}
                    onChange={(e) => p.onInput(e.target.value)}
                  />
                </label>
              ) : !result ? (
                <div className="study-no-result">
                  <Code2 size={25} />
                  <p>运行你的代码，在这里查看真实结果。</p>
                </div>
              ) : consoleTab === "tests" ? (
                <div className="study-test-list">
                  <h3>
                    {result.passed ? "全部样例通过" : "还有样例未通过"}
                    <small>
                      {result.tests.filter((t) => t.passed).length} /{" "}
                      {result.tests.length}
                    </small>
                  </h3>
                  {lesson.index === 5 && (
                    <p>
                      检查会实际调用square，使用多组参数，而不只检查屏幕上是否出现25。
                    </p>
                  )}
                  {result.tests.map((test, i) => (
                    <details key={i} open={!test.passed}>
                      <summary>
                        <span className={test.passed ? "correct" : "retry"}>
                          {test.passed ? "通过" : "未通过"}
                        </span>
                        样例{i + 1}
                        {test.input &&
                          ` · ${lesson.index === 5 ? "参数" : "输入"} ${test.input}`}
                      </summary>
                      <div>
                        <small>预期</small>
                        <pre>{test.expected}</pre>
                        <small>实际</small>
                        <pre>{test.actual || "（无输出）"}</pre>
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <div className="study-real-output">
                  <span>
                    {runStatusLabel[result.status] || "执行未完成"} ·{" "}
                    {result.durationMs} ms · 退出码 {result.exitCode}
                  </span>
                  <pre>{result.stdout || "（无标准输出）"}</pre>
                  {executionInterruption(result) && <p role="status">{executionInterruption(result)}</p>}
                  {(result.compileOutput || result.stderr) && (
                    <pre className="study-error">
                      {result.compileOutput || result.stderr}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
        <aside
          className={`study-coach chat-drawer ${chatOpen ? "drawer-open" : ""}`}
        >
          <button className="drawer-close" onClick={() => setChatOpen(false)}>
            关闭历史提问 <X size={16} />
          </button>
          <div className="study-coach-title">
            <MessageCircle size={19} />
            <h2>历史提问</h2>
            <span className={flow.configured ? "online" : ""}>
              {!status.checked
                ? "检查连接…"
                : flow.configured
                  ? "DeepSeek"
                  : "待连接"}
            </span>
          </div>
          <div className="study-coach-context" hidden={coachTab !== "chat"}>
            <b>结合当前课、代码与学习记录</b>
            <p>解释课程示例，或结合运行结果分析。</p>
            <label>
              提示深度
              <select
                aria-label="提示深度"
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
              >
                <option value={1}>方向提示</option>
                <option value={2}>关键位置</option>
                <option value={3}>局部表达式</option>
              </select>
            </label>
          </div>
          <div className="study-messages" hidden={coachTab !== "chat"}>
            {historyError && (
              <div className="study-error">
                {historyError}
                <button onClick={() => setReloadChats((v) => v + 1)}>
                  重新加载对话
                </button>
              </div>
            )}
            {!historyReady && !historyError && (
              <p className="muted-copy">正在读取对话…</p>
            )}
            {historyReady && !messages.length && (
              <div className="study-coach-empty">
                <Lightbulb size={26} />
                <h3>从一个具体问题开始</h3>
                <p>
                  “{lesson.concepts[0]}在这个例子里起什么作用？”
                  <br />
                  “我该用哪些输入验证这次修改？”
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                className={`study-message ${m.role} ${m.provider === "error" ? "error" : ""}`}
                key={i}
              >
                <span>
                  {m.role === "user"
                    ? "我的问题"
                    : m.provider === "deepseek"
                      ? "DeepSeek"
                      : m.provider === "error"
                        ? "请求未完成"
                        : "课程提示"}
                </span>
                <div>
                  <TeachingText text={m.content} />
                </div>
                {m.context?.revision && m.context.revision !== revision && (
                  <small className="old-message">基于旧版本代码或输入</small>
                )}
                {m.tools?.length ? <small>{m.tools.join(" · ")}</small> : null}
                {(
                  m.context?.focuses ??
                  (m.context?.focus ? [m.context.focus] : [])
                ).map((f) => (
                  <button
                    key={`${f.sceneId}:${f.stepId}`}
                    className="focus-step"
                    disabled={m.context?.revision !== revision}
                    onClick={() => {
                      const target = buildScene(lesson, f.options);
                      const index = target.steps.findIndex(
                        (s) => s.id === f.stepId,
                      );
                      if (target.id !== f.sceneId || index < 0) {
                        notify("示例已更新，无法恢复这条定位。请重新提问。");
                        return;
                      }
                      setOptions(f.options);
                      setPosition(index);
                      setVisualFocus((value) => value + 1);
                      setMode("visual");
                      setPane("visual");
                    }}
                  >
                    {f.label}
                    <ArrowRight size={13} />
                  </button>
                ))}
              </div>
            ))}
            {thinking && (
              <div className="study-thinking">
                <LoaderCircle size={15} className="spin" />
                正在查阅与整理…
              </div>
            )}
            <div ref={chatEnd} />
          </div>
          <div className="study-coach-compose" hidden={coachTab !== "chat"}>
            <div className="study-quick-prompts">
              <button
                disabled={thinking || !historyReady}
                onClick={() => ask("请解释当前课程示例的这一步。", "explain")}
              >
                解释这一步
              </button>
              <button
                disabled={thinking || !historyReady}
                onClick={() => ask("请按我选择的深度给一个提示。", "hint")}
              >
                给我提示
              </button>
              <button
                disabled={thinking || !historyReady}
                onClick={() =>
                  ask(
                    "请结合当前代码和输入的真实运行结果分析问题。",
                    "diagnose",
                  )
                }
              >
                分析结果
              </button>
              <button
                onClick={() => {
                  setMode("visual");
                  setPane("visual");
                  setReviewRequest((value) => value + 1);
                  setChatOpen(false);
                }}
              >
                理解检查
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void ask(question);
              }}
            >
              <textarea
                aria-label="向编程助教提问"
                placeholder="输入具体问题…"
                maxLength={2000}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    void ask(question);
                  }
                }}
              />
              <div>
                <small>Enter发送 · Shift Enter换行</small>
                {thinking ? (
                  <button
                    type="button"
                    aria-label="停止回答"
                    onClick={() => {
                      coachController.current?.abort();
                      setThinking(false);
                    }}
                  >
                    <X size={16} />
                  </button>
                ) : (
                  <button
                    aria-label="发送问题"
                    disabled={!question.trim() || !historyReady}
                  >
                    <Send size={16} />
                  </button>
                )}
              </div>
            </form>
            <small>模型解释需要验证；课程示例与运行事实分别标注。</small>
          </div>
        </aside>
      </div>
      {reset && (
        <div className="modal-overlay" onClick={() => setReset(false)}>
          <section
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-label="重置代码"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>恢复本课初始代码？</h3>
            <p>当前草稿将被替换，已完成的学习记录会保留。</p>
            <div>
              <button
                className="button secondary"
                onClick={() => setReset(false)}
              >
                继续编辑
              </button>
              <button
                className="button primary"
                onClick={() => {
                  p.onDraft(lesson.starter);
                  setReset(false);
                }}
              >
                重置代码
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
