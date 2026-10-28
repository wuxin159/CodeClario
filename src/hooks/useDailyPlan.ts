import { useEffect, useRef, useState } from "react";
import type { DailySnapshot } from "../../shared/daily";
import type { Language } from "../../shared/curriculum";
export function useDailyPlan(userId?: string) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [data, setData] = useState<DailySnapshot | null>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(!!userId),
    [error, setError] = useState("");
  const owner = useRef(userId),
    seq = useRef(0);
  owner.current = userId;
  async function prepare(
    extra: {
      minutes?: number;
      language?: Language;
      message?: string;
      advance?: boolean;
    } = {},
  ) {
    if (!userId) return;
    const generation = ++seq.current;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/daily/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, timeZone: tz, ...extra }),
        }),
        value = await r.json();
      if (!r.ok || value.userId !== userId)
        throw Error(value.error ?? "今日安排暂未完成。");
      if (owner.current === userId && seq.current === generation)
        setData(value);
    } catch (e) {
      if (owner.current === userId && seq.current === generation)
        setError((e as Error).message);
    } finally {
      if (owner.current === userId && seq.current === generation)
        setBusy(false);
    }
  }
  useEffect(() => {
    setData(null);
    setError("");
    setBusy(false);
    setLoading(!!userId);
    const generation = ++seq.current;
    let live = true;
    if (userId)
      void fetch("/api/daily?timeZone=" + encodeURIComponent(tz))
        .then((r) => r.json())
        .then((value) => {
          if (!live || owner.current !== userId || seq.current !== generation)
            return;
          if (value.userId !== userId)
            throw Error(value.error ?? "读取今日安排失败。");
          setData(value);
          setLoading(false);
          if (!value.plan && value.configured) void prepare();
        })
        .catch((e) => {
          if (live) {
            setError(e.message);
            setLoading(false);
          }
        });
    return () => {
      live = false;
      seq.current++;
    };
  }, [userId]);
  async function refresh() {
    if (!userId) return;
    const r = await fetch("/api/daily?timeZone=" + encodeURIComponent(tz)),
      value = await r.json();
    if (r.ok && owner.current === userId && value.userId === userId)
      setData(value);
  }
  async function start(index: number) {
    if (!data?.plan || !userId) return null;
    setError("");
    setBusy(true);
    try {
      const r = await fetch("/api/daily/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            timeZone: tz,
            planId: data.plan.id,
            revision: data.plan.revision,
            index,
          }),
        }),
        v = await r.json();
      if (!r.ok || v.userId !== userId)
        throw Error(v.error ?? "任务没有开始，请重试。");
      if (owner.current === userId) return v.lessonId as string;
    } catch (e) {
      if (owner.current === userId) setError((e as Error).message);
    } finally {
      if (owner.current === userId) setBusy(false);
    }
    return null;
  }
  return {
    ...(data?.userId === userId ? data : null),
    loading,
    busy,
    error,
    prepare,
    start,
    refresh,
  };
}
export type DailyLearning = ReturnType<typeof useDailyPlan>;
