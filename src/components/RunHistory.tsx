import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Code2 } from "lucide-react";
import { findLesson, languages } from "../../shared/curriculum";
import type { AttemptSummary } from "../../shared/account";

type Item = AttemptSummary & { createdAt: number };
export default function RunHistory({
  userId,
  revision,
  onInspect,
}: {
  userId: string;
  revision: number;
  onInspect: (id: string) => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pending = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  async function load(next: string | null, reset = false) {
    const ticket = ++sequence.current;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    setError("");
    if (reset) {
      setItems([]);
      setCursor(null);
    }
    try {
      const response = await fetch(
        `/api/learning/history${next ? `?cursor=${encodeURIComponent(next)}` : ""}`,
        { signal: controller.signal },
      );
      const data = await response.json();
      if (!response.ok || data.userId !== userId)
        throw new Error(data.error || "历史读取失败。");
      if (ticket !== sequence.current || controller.signal.aborted) return;
      setItems((previous) =>
        reset ? data.items : [...previous, ...data.items],
      );
      setCursor(data.nextCursor);
    } catch (e) {
      if (!controller.signal.aborted && ticket === sequence.current)
        setError((e as Error).message);
    } finally {
      if (ticket === sequence.current) setLoading(false);
    }
  }
  useEffect(() => {
    void load(null, true);
    return () => {
      ++sequence.current;
      pending.current?.abort();
    };
  }, [userId, revision]);
  return (
    <div className="run-history">
      {items.map((item) => {
        const lesson = findLesson(item.lessonId);
        return (
          <button
            className="record-row"
            key={item.id}
            onClick={() => onInspect(item.id)}
          >
            <span className={`record-icon ${item.passed ? "passed" : ""}`}>
              {item.passed ? <Check size={17} /> : <Code2 size={17} />}
            </span>
            <div>
              <b>{lesson?.title || "历史课程"}</b>
              <small>
                {languages.find((l) => l.id === lesson?.language)?.name || ""} ·{" "}
                {item.date}{" "}
                {new Date(item.createdAt).toLocaleTimeString("zh-CN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </small>
            </div>
            <span className={`result-pill ${item.passed ? "success" : ""}`}>
              {item.passed ? "样例通过" : "未通过"}
            </span>
            <ChevronRight size={16} />
          </button>
        );
      })}
      {error && (
        <p className="study-error" role="alert">
          {error}
          <button
            className="history-more"
            onClick={() => load(items.length ? cursor : null, !items.length)}
          >
            重新加载
          </button>
        </p>
      )}
      {loading ? (
        <p className="history-status" role="status">
          正在读取运行记录…
        </p>
      ) : !error && cursor ? (
        <button className="history-more" onClick={() => load(cursor)}>
          加载更早记录
          <ChevronRight size={14} />
        </button>
      ) : (
        !error && (
          <p className="history-status">已显示全部{items.length}条运行记录。</p>
        )
      )}
    </div>
  );
}
