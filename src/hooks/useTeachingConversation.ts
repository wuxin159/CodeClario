import { useCallback, useEffect, useRef, useState } from "react";
import type { TeachingConversationEvent } from "../../shared/flow";

export function useTeachingConversation(
  userId: string | undefined,
  lessonId: string,
  updatedAt?: number,
) {
  const [events, setEvents] = useState<TeachingConversationEvent[]>([]),
    [before, setBefore] = useState<number | null>(null),
    [error, setError] = useState("");
  const generation = useRef(0),
    identity = useRef({ userId, lessonId });
  identity.current = { userId, lessonId };
  const load = useCallback(
    async (older?: number) => {
      if (!userId) return;
      const seq = ++generation.current,
        who = { userId, lessonId };
      try {
        const res = await fetch(
            `/api/flow/conversation/${encodeURIComponent(lessonId)}${older ? "?before=" + older : ""}`,
          ),
          data = await res.json();
        if (!res.ok || data.userId !== userId)
          throw new Error(data.error ?? "教学对话读取失败");
        if (
          seq !== generation.current ||
          identity.current.userId !== who.userId ||
          identity.current.lessonId !== who.lessonId
        )
          return;
        setError("");
        setBefore(data.before);
        setEvents((previous) =>
          older
            ? [
                ...new Map(
                  [...data.events, ...previous].map(
                    (e: TeachingConversationEvent) => [e.id, e],
                  ),
                ).values(),
              ].sort((a, b) => a.id - b.id)
            : data.events,
        );
      } catch (e) {
        if (
          seq === generation.current &&
          identity.current.userId === who.userId &&
          identity.current.lessonId === who.lessonId
        )
          setError((e as Error).message);
      }
    },
    [userId, lessonId],
  );
  useEffect(() => {
    setEvents([]);
    setBefore(null);
    setError("");
    generation.current++;
    return () => {
      generation.current++;
    };
  }, [userId, lessonId]);
  useEffect(() => {
    void load();
  }, [load, updatedAt]);
  return {
    events,
    before,
    error,
    refresh: () => load(),
    earlier: () => (before ? load(before) : Promise.resolve()),
  };
}
