import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import type { Missions } from "../hooks/useMissions";
import type { Mission } from "../../shared/mission";
import type { LearningTask } from "../../shared/flow";
import { findLesson } from "../../shared/curriculum";
export default function MissionHistory({
  missions: m,
  userId,
  onOpen,
}: {
  missions: Missions;
  userId?: string;
  onOpen: (id: string) => void;
}) {
  const [detail, setDetail] = useState<{
      mission: Mission;
      episodes: LearningTask[];
      courseChecks?: {
        kind: string;
        answer: number;
        correct: number;
        createdAt: number;
      }[];
    } | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const tasks = [...(m.active ? [m.active] : []), ...m.recent];
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!detail) return;
    const previous = document.activeElement as HTMLElement | null;
    const controls = () =>
      Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),summary,[tabindex="0"]',
        ) ?? [],
      );
    controls()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setDetail(null);
      }
      if (event.key === "Tab") {
        const items = controls(),
          first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [detail?.mission.id]);
  async function open(id: string) {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/missions/" + id),
        d = await r.json();
      if (!r.ok || d.userId !== userId)
        throw new Error(d.error ?? "任务记录读取失败。");
      setDetail(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="mission-history panel">
      <div className="section-heading">
        <div>
          <h2>学习任务与练习过程</h2>
          <p>按任务回看“预期、真实执行、理解说明与迁移检验”。</p>
        </div>
      </div>
      {!tasks.length ? (
        <p className="mission-empty">
          {userId
            ? "从我的学习安排第一项任务，或将课程设为当前任务。此前的课程与运行记录仍保留在下方。"
            : "登录后查看你的任务记录。"}
        </p>
      ) : (
        <div className="mission-history-list">
          {tasks.map((t) => (
            <button
              key={t.id}
              disabled={loading}
              onClick={() => void open(t.id)}
            >
              <span className="recent-status">
                {t.status === "completed" ? (
                  <Check size={16} />
                ) : (
                  <ArrowRight size={16} />
                )}
              </span>
              <div>
                <b>{t.title}</b>
                <small>
                  {findLesson(t.lessonId)?.title} ·{" "}
                  {t.source === "deepseek" ? "AI安排" : "自主选择"} ·{" "}
                  {t.status === "completed"
                    ? "本次验证完成"
                    : t.status === "paused"
                      ? "已暂停"
                      : "进行中"}
                </small>
              </div>
              <span>
                查看过程
                <ArrowRight size={13} />
              </span>
            </button>
          ))}
        </div>
      )}
      {error && (
        <p className="mission-error" role="alert">
          {error}
        </p>
      )}
      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <section
            ref={dialog}
            className="mission-detail"
            role="dialog"
            aria-modal="true"
            aria-label="练习过程"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <small>练习过程</small>
              <button aria-label="关闭练习过程" onClick={() => setDetail(null)}>
                <X size={20} />
              </button>
            </header>
            <h2>{detail.mission.title}</h2>
            <p>
              {findLesson(detail.mission.lessonId)?.task ??
                detail.mission.objective}
            </p>
            <div className="task-reason">
              <div>
                <b>
                  {detail.mission.source === "deepseek"
                    ? "AI选择依据"
                    : "选择来源"}
                </b>
                <p>{detail.mission.reason}</p>
              </div>
            </div>
            {!detail.episodes.length && (
              <p>尚未产生本次任务的预测或运行记录。</p>
            )}
            <ol>
              {detail.episodes.map((e, i) => (
                <li key={e.id}>
                  <span className="trail-version">
                    版本 {i + 1} · {e.revision.slice(0, 8)}
                  </span>
                  {e.prediction && (
                    <p>
                      <b>我的预期：</b>
                      {e.prediction.value || "（无输出）"}
                    </p>
                  )}
                  {e.comparison && (
                    <p>
                      <b>真实核对：</b>
                      {e.comparison.actual ??
                        e.comparison.reason ??
                        "暂不可核对"}
                    </p>
                  )}
                  <p>
                    <b>编码验证：</b>
                    {e.practicePassed
                      ? "本次样例通过"
                      : e.attemptId
                        ? "仍需修改"
                        : "尚未运行"}
                  </p>
                  {e.decision && (
                    <p>
                      <b>AI选择：</b>
                      {e.decision.title}
                    </p>
                  )}
                  {e.answers.map((a, j) => (
                    <details key={j}>
                      <summary>理解说明 {j + 1}</summary>
                      <p>{a.question}</p>
                      <p>{a.answer}</p>
                    </details>
                  ))}
                  {e.retestResult && (
                    <p>
                      <b>迁移检验：</b>
                      {e.retestResult.correct
                        ? e.retestResult.assisted
                          ? "AI辅助后通过"
                          : e.retestResult.corrected
                            ? "参考解析后订正"
                            : e.retestResult.repeated
                              ? "重复题通过"
                              : "首次独立通过"
                        : "尚未通过"}
                    </p>
                  )}
                </li>
              ))}
            </ol>
            {!!detail.courseChecks?.length && (
              <section className="mission-course-checks">
                <h3>课程理解作答</h3>
                <p>课程审校题，与独立迁移复测分别记录。</p>
                {detail.courseChecks.map((c, i) => (
                  <p key={`${c.createdAt}:${i}`}>
                    第{i + 1}次 ·{" "}
                    {c.kind === "review" ? "理解检查" : "课程预测"} ·{" "}
                    {c.correct ? "回答正确" : "待复核"}
                  </p>
                ))}
              </section>
            )}
            <button
              className="button primary"
              onClick={() => {
                onOpen(detail.mission.lessonId);
                setDetail(null);
              }}
            >
              进入课程实践
              <ArrowRight size={15} />
            </button>
          </section>
        </div>
      )}
    </section>
  );
}
