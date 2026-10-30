import { useEffect, useRef, useState } from "react";
import type {
  LearningTask,
  Prediction,
  TeachingViewContext,
} from "../../shared/flow";
import type { RunResult } from "../../shared/curriculum";

export function useTeachingFlow({
  userId,
  lessonId,
  code,
  stdin,
}: {
  userId?: string;
  lessonId: string;
  code: string;
  stdin: string;
}) {
  const [task, setTask] = useState<LearningTask | null>(null);
  const [loading, setLoading] = useState(!!userId),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [configured, setConfigured] = useState(false);
  const [enabled, setEnabled] = useState(
    () =>
      localStorage.getItem(`codeclario-auto:${userId ?? "guest"}`) !== "off",
  );
  const controller = useRef<AbortController | null>(null),
    version = useRef({ userId, lessonId, code, stdin });
  const pendingRequest = useRef<{
    trigger: string;
    extra: object;
    snapshot: typeof version.current;
  } | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  version.current = { userId, lessonId, code, stdin };
  const stale = !!task && (task.code !== code || task.stdin !== stdin);
  useEffect(() => {
    setTask(null);
    setError("");
    setEnabled(
      localStorage.getItem(`codeclario-auto:${userId ?? "guest"}`) !== "off",
    );
    if (!userId) return;
    const c = new AbortController();
    setLoading(true);
    Promise.all([
      fetch(`/api/flow/${lessonId}`, { signal: c.signal }).then((r) =>
        r.json(),
      ),
      fetch("/api/ai/config", { signal: c.signal }).then((r) => r.json()),
    ])
      .then(([data, config]) => {
        if (data.userId !== userId)
          throw new Error(data.error ?? "学习任务加载失败。");
        setTask(data.task);
        setConfigured(!!config.configured);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => {
      c.abort();
      controller.current?.abort();
    };
  }, [userId, lessonId]);
  useEffect(() => {
    controller.current?.abort();
    setBusy(false);
  }, [code, stdin]);
  const payload = () => ({ userId, lessonId, code, stdin });
  async function request(path: string, body: object, signal?: AbortSignal) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    const data = await response.json();
    if (!response.ok) {
      if (data.code === "AI_NOT_CONFIGURED") setConfigured(false);
      throw Object.assign(new Error(data.error ?? "请求未完成。"), {
        task: data.task,
      });
    }
    return data;
  }
  async function analyze(
    trigger: string,
    extra: object = {},
    currentTask: LearningTask | null = stale ? null : task,
    force = false,
  ) {
    if (!mounted.current || !userId || (!enabled && !force)) return false;
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    const snapshot = version.current;
    // 请求使用不可变的课程/代码/输入快照，响应回来后只更新仍匹配这份快照的页面。
    pendingRequest.current = { trigger, extra, snapshot };
    setBusy(true);
    setError("");
    try {
      const data = await request(
        "/api/flow/analyze",
        {
          ...payload(),
          trigger,
          ...(currentTask ? { taskId: currentTask.id } : {}),
          ...extra,
        },
        c.signal,
      );
      if (!c.signal.aborted && stillCurrent(snapshot)) {
        setTask(data.task);
        setConfigured(true);
        pendingRequest.current = null;
        return true;
      }
    } catch (e) {
      if (!c.signal.aborted && stillCurrent(snapshot)) {
        const failure = e as Error & { task?: LearningTask };
        if (failure.task) setTask(failure.task);
        setError(failure.message);
      }
    } finally {
      if (controller.current === c) setBusy(false);
    }
    return false;
  }
  // React 每次渲染会创建新对象，因此比较字段内容，不能仅比较对象引用。
  const stillCurrent = (snapshot: typeof version.current) =>
    mounted.current &&
    snapshot.userId === version.current.userId &&
    snapshot.lessonId === version.current.lessonId &&
    snapshot.code === version.current.code &&
    snapshot.stdin === version.current.stdin;
  async function predict(prediction: Prediction) {
    if (!userId) throw new Error("请先登录，再保存预测。");
    const snapshot = version.current;
    setError("");
    const data = await request("/api/flow/predict", {
      ...payload(),
      prediction,
    });
    if (!stillCurrent(snapshot)) return;
    setTask(data.task);
    void analyze("prediction", {}, data.task);
  }
  async function afterRun(
    result: RunResult,
    runCode: string,
    runInput: string,
  ) {
    if (runCode !== version.current.code || runInput !== version.current.stdin)
      return;
    const response = await fetch(`/api/flow/${lessonId}`);
    const data = await response.json();
    if (
      !mounted.current ||
      runCode !== version.current.code ||
      runInput !== version.current.stdin ||
      data.userId !== userId ||
      data.task?.attemptId !== result.id
    )
      return;
    setTask(data.task);
    void analyze("run", { attemptId: result.id }, data.task);
  }
  async function startRetest() {
    if (!task || stale) return;
    const snapshot = version.current;
    const data = await request("/api/flow/retest/start", {
      ...payload(),
      taskId: task.id,
    });
    if (stillCurrent(snapshot)) setTask(data.task);
  }
  async function submitRetest(answer: number) {
    if (!task || stale) return;
    const snapshot = version.current;
    const data = await request("/api/flow/retest", {
      ...payload(),
      taskId: task.id,
      retestId: task.retest?.id,
      answer,
    });
    if (!stillCurrent(snapshot)) return;
    setTask(data.task);
    void analyze("retest", {}, data.task);
  }
  function toggleEnabled(value: boolean) {
    setEnabled(value);
    localStorage.setItem(
      `codeclario-auto:${userId ?? "guest"}`,
      value ? "on" : "off",
    );
    if (!value) {
      controller.current?.abort();
      setBusy(false);
    }
  }
  return {
    task,
    loading,
    busy,
    replyPending:
      busy &&
      !!pendingRequest.current &&
      ["discussion", "prediction_reply", "answer"].includes(
        pendingRequest.current.trigger,
      ),
    error,
    stale,
    configured,
    setConfigured,
    enabled,
    toggleEnabled,
    predict,
    afterRun,
    startRetest,
    submitRetest,
    onStudy: () => {
      setTask((previous) =>
        previous ? { ...previous, decision: undefined } : previous,
      );
      return analyze("study");
    },
    answer: (answer: string) => analyze("answer", { answer }, task, true),
    retry: () => {
      const previous = pendingRequest.current;
      if (previous && stillCurrent(previous.snapshot))
        return analyze(
          previous.trigger,
          previous.extra,
          stale ? null : task,
          true,
        );
      return analyze(
        task?.attemptId ? "run" : (task?.trigger ?? "study"),
        task?.attemptId ? { attemptId: task.attemptId } : {},
        task,
        true,
      );
    },
    stop: () => {
      controller.current?.abort();
      setBusy(false);
    },
    setError,
    enter: () => analyze("entry", {}, null),
    observeExperiment: (viewContext: TeachingViewContext) =>
      analyze("experiment", { viewContext }, stale ? null : task),
    discuss: (answer: string, viewContext?: TeachingViewContext) =>
      analyze(
        "discussion",
        { answer, viewContext: viewContext ?? null },
        stale ? null : task,
        true,
      ),
    replyPrediction: (answer: string) =>
      analyze("prediction_reply", { answer }, task, true),
  };
}
export type TeachingFlow = ReturnType<typeof useTeachingFlow>;
