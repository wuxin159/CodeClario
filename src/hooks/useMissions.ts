import { useCallback, useEffect, useRef, useState } from "react";
import type { LearningGoal, MissionSnapshot } from "../../shared/mission";

const empty: MissionSnapshot = {
  active: null,
  progress: null,
  recent: [],
  configured: false,
};
export function useMissions(userId?: string) {
  const [data, setData] = useState<MissionSnapshot>(empty),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [resolvedUser, setResolvedUser] = useState<string | undefined>();
  const current = useRef(userId),
    controller = useRef<AbortController | null>(null),
    sequence = useRef(0);
  current.current = userId;
  const refresh = useCallback(async () => {
    if (!userId) return;
    const seq = ++sequence.current;
    try {
      const response = await fetch("/api/missions"),
        value = await response.json();
      if (!response.ok || value.userId !== userId)
        throw new Error(value.error || "任务读取失败。");
      if (current.current === userId && sequence.current === seq)
        setData(value);
    } catch (e) {
      if (current.current === userId) setError((e as Error).message);
    } finally {
      if (current.current === userId && sequence.current === seq) {
        setResolvedUser(userId);
        setLoading(false);
      }
    }
  }, [userId]);
  useEffect(() => {
    setData(empty);
    setResolvedUser(undefined);
    setError("");
    setBusy(false);
    setLoading(!!userId);
    void refresh();
    return () => {
      controller.current?.abort();
      sequence.current++;
    };
  }, [userId, refresh]);
  const mutate = async (path: string, body: object) => {
    if (!userId) return null;
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setBusy(true);
    setError("");
    sequence.current++;
    try {
      const response = await fetch("/api/missions/" + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...body }),
        signal: c.signal,
      });
      const value = await response.json();
      if (!response.ok || value.userId !== userId)
        throw new Error(value.error || "任务安排失败。");
      if (current.current === userId && !c.signal.aborted) {
        sequence.current++;
        setData(value);
        return value as MissionSnapshot;
      }
    } catch (e) {
      if (!c.signal.aborted && current.current === userId)
        setError((e as Error).message);
    } finally {
      if (controller.current === c) setBusy(false);
    }
    return null;
  };
  return {
    ...data,
    busy,
    loading: loading || (!!userId && resolvedUser !== userId),
    error,
    refresh,
    plan: (goal: LearningGoal) => mutate("plan", { goal }),
    advance: () =>
      mutate("plan", { advance: true, missionId: data.active?.id }),
    adopt: (lessonId: string) => mutate("manual", { lessonId }),
    stop: () => {
      controller.current?.abort();
      setBusy(false);
    },
  };
}
export type Missions = ReturnType<typeof useMissions>;
