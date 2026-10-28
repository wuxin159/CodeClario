import { useEffect, useRef, useState } from "react";
import type { FlowHistoryItem, LearningTask } from "../../shared/flow";
import { findLesson } from "../../shared/curriculum";
import { ArrowRight } from "lucide-react";
import TeachingText from "./TeachingText";
export default function FlowOverview({
  userId,
  onOpen,
}: {
  userId?: string;
  onOpen: (id: string) => void;
}) {
  const [items, setItems] = useState<FlowHistoryItem[]>([]),
    [error, setError] = useState("");
  const [cursor, setCursor] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [detail, setDetail] = useState<LearningTask | null>(null);
  const detailTarget = useRef<HTMLElement>(null);
  useEffect(() => {
    if (detail)
      detailTarget.current?.scrollIntoView({
        block: "start",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  }, [detail?.id]);
  async function load(next?: string, signal?: AbortSignal) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        "/api/flow/history" +
          (next ? `?cursor=${encodeURIComponent(next)}` : ""),
        { signal },
      );
      const data = await response.json();
      if (!response.ok || data.userId !== userId)
        throw new Error(data.error ?? "诊断记录读取失败。");
      setItems((old) =>
        next
          ? [
              ...old,
              ...data.items.filter(
                (t: FlowHistoryItem) => !old.some((x) => x.id === t.id),
              ),
            ]
          : data.items,
      );
      setCursor(data.nextCursor);
    } catch (e) {
      if (!signal?.aborted) setError((e as Error).message);
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  }
  useEffect(() => {
    setItems([]);
    setDetail(null);
    if (!userId) return;
    const c = new AbortController();
    void load(undefined, c.signal);
    return () => c.abort();
  }, [userId]);
  async function inspect(id: string) {
    setError("");
    try {
      const r = await fetch(`/api/flow/task/${id}`);
      const data = await r.json();
      if (!r.ok || data.userId !== userId)
        throw new Error(data.error ?? "记录读取失败。");
      setDetail(data.task);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="panel flow-overview">
      <div>
        <h2>AI诊断与复测</h2>
        <p>查看预测差异、引导记录和迁移题结果，继续有依据的复习。</p>
      </div>
      {error ? (
        <p role="alert">
          {error}
          <button onClick={() => void load()}>重试</button>
        </p>
      ) : !items.length ? (
        <p>
          {busy
            ? "正在读取学习过程…"
            : "完成一次预测或运行后，这里会保存本次学习过程。"}
        </p>
      ) : (
        items.map((item) => (
          <button key={item.id} onClick={() => void inspect(item.id)}>
            <span>
              <b>{findLesson(item.lessonId)?.title}</b>
              <small>{item.title}</small>
            </span>
            <em>
              {item.retestResult
                ? item.retestResult.correct
                  ? item.retestResult.assisted
                    ? "AI辅助后通过"
                    : item.retestResult.repeated
                      ? "重复作答"
                      : item.retestResult.corrected
                        ? "已订正"
                        : "复测通过"
                  : "建议复习"
                : item.comparison?.matches === false
                  ? "有预测差异"
                  : "查看过程"}
            </em>
            <ArrowRight size={14} />
          </button>
        ))
      )}
      {cursor && (
        <button
          className="flow-load-more"
          disabled={busy}
          onClick={() => void load(cursor)}
        >
          {busy ? "正在加载…" : "加载更早的诊断记录"}
        </button>
      )}
      {detail && (
        <section
          ref={detailTarget}
          className="flow-history-detail"
          aria-label="诊断记录详情"
        >
          <div>
            <b>历史学习过程 · 只读</b>
            <button onClick={() => setDetail(null)}>收起详情</button>
          </div>
          <h3>{findLesson(detail.lessonId)?.title}</h3>
          <small>
            {new Date(detail.updatedAt).toLocaleString("zh-CN", {
              timeZone: "Asia/Singapore",
            })}
          </small>
          {detail.prediction && (
            <p>预测：{detail.prediction.value || "（无输出）"}</p>
          )}
          {detail.comparison && (
            <p>
              实际：
              {detail.comparison.actual ??
                detail.comparison.reason ??
                "尚未核对"}
            </p>
          )}
          {detail.decision && (
            <>
              <h3>{detail.decision.title}</h3>
              <TeachingText text={detail.decision.summary} />
              {detail.decision.hypothesis && (
                <p>待确认假设：{detail.decision.hypothesis}</p>
              )}
            </>
          )}
          {detail.answers.map((a, i) => (
            <div key={i}>
              <b>{a.question}</b>
              <p>{a.answer}</p>
            </div>
          ))}
          {detail.retestResult && (
            <p>
              {detail.retestResult.correct
                ? detail.retestResult.assisted
                  ? "本题在AI讲解后通过"
                  : detail.retestResult.repeated
                    ? "这道题为重复作答"
                    : detail.retestResult.corrected
                      ? "本题经解析后已订正"
                      : "这次复测通过"
                : "这次复测未通过"}
              ：{detail.retestResult.explanation}
            </p>
          )}
          <details>
            <summary>查看当时的代码与输入</summary>
            <pre>{detail.code}</pre>
            <pre>{detail.stdin || "（标准输入为空）"}</pre>
          </details>
          <button
            className="flow-focus"
            onClick={() => onOpen(detail.lessonId)}
          >
            返回本课继续学习
            <ArrowRight size={13} />
          </button>
        </section>
      )}
    </section>
  );
}
