import { useCallback, useEffect, useRef, useState } from "react";
import {
  emptyLearningState,
  type LearningState,
  type PublicUser,
} from "../../shared/account";
import { findLesson } from "../../shared/curriculum";

export async function apiRequest(url: string, body?: unknown, method = "POST") {
  const response = await fetch(url, {
    method,
    credentials: "same-origin",
    signal: AbortSignal.timeout(12000),
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch((error: unknown) => {
    throw new Error(
      error instanceof DOMException && error.name === "TimeoutError"
        ? "连接超时，请重试。"
        : "暂时无法连接服务器，请稍后重试。",
    );
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "请求未完成，请重试。");
  return payload;
}
function draftPayload(state: LearningState, userId: string) {
  const ids = [
    ...new Set([...Object.keys(state.drafts), ...Object.keys(state.inputs)]),
  ].filter((id) => findLesson(id));
  return {
    userId,
    lastLesson: state.lastLesson,
    drafts: ids.map((lessonId) => ({
      lessonId,
      code: state.drafts[lessonId] ?? findLesson(lessonId)!.starter,
      stdin: state.inputs[lessonId] ?? findLesson(lessonId)!.stdin,
    })),
  };
}

export function useLearningAccount() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [state, setState] = useState<LearningState>(emptyLearningState);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<
    "saved" | "saving" | "error" | "guest"
  >("guest");
  const [error, setError] = useState("");
  const identity = useRef<string | null>(null);
  const epoch = useRef(0);
  const latest = useRef({ user, state });
  latest.current = { user, state };
  const savedSignature = useRef("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const channel = useRef<BroadcastChannel | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const refreshSequence = useRef(0);

  const acceptAccount = useCallback(
    (next: PublicUser | null, learning: LearningState) => {
      epoch.current++;
      clearTimeout(saveTimer.current);
      identity.current = next?.id ?? null;
      savedSignature.current = next
        ? JSON.stringify(draftPayload(learning, next.id))
        : "";
      latest.current = { user: next, state: learning };
      setUser(next);
      setState(learning);
      setSaveStatus(next ? "saved" : "guest");
      setError("");
    },
    [],
  );

  const readSession = useCallback(async () => {
    const generation = ++epoch.current;
    try {
      const payload = await apiRequest("/api/auth/me", undefined, "GET");
      if (generation !== epoch.current) return;
      if (!payload.user) {
        acceptAccount(null, emptyLearningState());
        setLoading(false);
        return;
      }
      const learning = await apiRequest("/api/learning", undefined, "GET");
      if (generation !== epoch.current) return;
      if (learning.userId !== payload.user.id)
        throw new Error("账户状态已变化，请刷新页面。");
      acceptAccount(payload.user, learning.state);
      setLoading(false);
    } catch (err) {
      if (generation === epoch.current) {
        setError((err as Error).message);
        setLoading(false);
      }
    }
  }, [acceptAccount]);

  useEffect(() => {
    void readSession();
    return () => {
      epoch.current++;
      clearTimeout(saveTimer.current);
    };
  }, [readSession]);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const bus = new BroadcastChannel("learning-platform-account");
    channel.current = bus;
    bus.onmessage = () => {
      setLoading(true);
      void readSession();
    };
    return () => {
      bus.close();
      channel.current = null;
    };
  }, [readSession]);

  const flush = useCallback(() => {
    const requestedUser = identity.current;
    const operation = saveQueue.current
      .catch(() => {})
      .then(async () => {
        if (identity.current !== requestedUser) return;

        const snapshot = latest.current;
        if (!snapshot.user || identity.current !== snapshot.user.id) return;
        const generation = epoch.current,
          payload = draftPayload(snapshot.state, snapshot.user.id),
          signature = JSON.stringify(payload);
        if (signature === savedSignature.current) return;
        setSaveStatus("saving");
        try {
          await apiRequest("/api/learning/drafts", payload, "PUT");
          if (
            generation !== epoch.current ||
            identity.current !== snapshot.user.id
          )
            return;
          savedSignature.current = signature;
          setSaveStatus("saved");
          setError("");
        } catch (err) {
          if (generation === epoch.current) {
            setSaveStatus("error");
            setError((err as Error).message);
          }
          throw err;
        }
      });
    saveQueue.current = operation;
    return operation;
  }, []);

  useEffect(() => {
    if (!user || loading) return;
    const signature = JSON.stringify(draftPayload(state, user.id));
    if (signature === savedSignature.current) return;
    setSaveStatus("saving");
    saveTimer.current = setTimeout(() => {
      void flush().catch(() => {});
    }, 700);
    return () => clearTimeout(saveTimer.current);
  }, [user?.id, state.drafts, state.inputs, state.lastLesson, loading, flush]);

  useEffect(() => {
    const leave = () => {
      const snapshot = latest.current;
      if (!snapshot.user) return;
      const payload = draftPayload(snapshot.state, snapshot.user.id);
      if (JSON.stringify(payload) !== savedSignature.current) {
        void fetch("/api/learning/drafts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => {});
      }
    };
    window.addEventListener("pagehide", leave);
    return () => window.removeEventListener("pagehide", leave);
  }, []);

  async function authenticate(
    mode: "login" | "register",
    values: { username: string; password: string; displayName?: string },
  ) {
    const result = await apiRequest(`/api/auth/${mode}`, values);
    acceptAccount(result.user, result.learning);
    channel.current?.postMessage("changed");
  }
  async function logout() {
    await flush();
    const current = latest.current.user;
    if (!current) return;
    await apiRequest("/api/auth/logout", { userId: current.id });
    acceptAccount(null, emptyLearningState());
    channel.current?.postMessage("changed");
  }
  async function refreshLearning(expectedUserId: string) {
    if (identity.current !== expectedUserId) return;
    const sequence = ++refreshSequence.current;
    const generation = epoch.current;
    const payload = await apiRequest("/api/learning", undefined, "GET");
    if (
      identity.current !== expectedUserId ||
      sequence !== refreshSequence.current ||
      epoch.current !== generation ||
      payload.userId !== expectedUserId
    )
      return;
    // The server owns completion and attempt records; preserve any newer local editor changes.
    setState((current) => ({
      ...current,
      attempts: payload.state.attempts,
      completed: payload.state.completed,
      study: payload.state.study,
      totals: payload.state.totals,
      activity: payload.state.activity,
    }));
  }
  async function updateProfile(displayName: string) {
    const current = latest.current.user;
    if (!current) return;
    const payload = await apiRequest(
      "/api/auth/profile",
      { userId: current.id, displayName },
      "PATCH",
    );
    if (identity.current === current.id) {
      setUser(payload.user);
      latest.current.user = payload.user;
    }
  }
  async function changePassword(currentPassword: string, newPassword: string) {
    const current = latest.current.user;
    if (!current) return;
    await apiRequest("/api/auth/password", {
      userId: current.id,
      currentPassword,
      newPassword,
    });
    channel.current?.postMessage("changed");
  }
  return {
    user,
    state,
    setState,
    loading,
    saveStatus,
    error,
    authenticate,
    logout,
    refreshLearning,
    flush,
    updateProfile,
    changePassword,
  };
}
