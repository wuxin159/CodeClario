import { useState } from "react";
import { ArrowRight, LoaderCircle, Send } from "lucide-react";
import type { DailyLearning } from "../hooks/useDailyPlan";
import type { Missions } from "../hooks/useMissions";
import type { Language } from "../../shared/curriculum";
export default function DailyWelcome({
  daily: d,
  missions: m,
  name,
  onOpen,
  onFlush,
}: {
  daily: DailyLearning;
  missions: Missions;
  name: string;
  onOpen: (id: string) => void;
  onFlush: () => Promise<unknown>;
}) {
  const [message, setMessage] = useState(""),
    [starting, setStarting] = useState(false);
  const reply = async () => {
    // 失败保留原意愿；请求成功时也不能清掉学生等待期间继续输入的新内容。
    const submitted = message.trim();
    if (!submitted || d.busy) return;
    if (await d.prepare({ message: submitted }))
      setMessage((current) => current.trim() === submitted ? "" : current);
  };
  const start = async (index: number) => {
    setStarting(true);
    try {
      await onFlush();
      if (d.progress?.[index]?.state === "verified" && d.plan?.steps[index]) {
        onOpen(d.plan.steps[index].lessonId);
        return;
      }
      const id = await d.start(index);
      if (id) {
        await m.refresh();
        onOpen(id);
      }
    } finally {
      setStarting(false);
    }
  };
  const hour = new Date().getHours(),
    salutation =
      hour < 6
        ? "夜深了"
        : hour < 12
          ? "上午好"
          : hour < 18
            ? "下午好"
            : "晚上好";
  const hasActivity = !!d.progress?.some((p) => p.state !== "pending");
  const complete =
    !!d.plan &&
    d.progress?.length === d.plan.steps.length &&
    d.progress.every((p) => p.state === "verified");
  const nextIndex = d.progress?.findIndex((p) => p.state !== "verified") ?? 0;
  const resume = !!m.active && !m.progress?.canAdvance;
  const next = async () => {
    setStarting(true);
    try {
      await onFlush();
      const value = await m.advance();
      if (value) await d.prepare({ advance: true });
    } finally {
      setStarting(false);
    }
  };
  const liveGreeting = complete
    ? resume
      ? "这份安排已完成。当前的新任务是“" +
        m.active!.title +
        "”，可以接着它继续。"
      : "这份安排已经完成实际检查。你可以休息，也可以让我结合新记录安排下一小步。"
    : hasActivity
      ? "接着刚才的进度：" +
        (d.plan?.steps[Math.max(0, nextIndex)]?.title ?? "当前任务") +
        "，" +
        (d.progress?.[Math.max(0, nextIndex)]?.text ?? "待开始") +
        "。不必重头来过，可以继续刚才的代码。"
      : null;
  return (
    <section className="daily-welcome" aria-label="AI今日学习安排">
      <div className="daily-dialogue">
        <div className="daily-teacher">
          <img src="/brand/mark-gradient.png" alt="" />
          <span>
            AI老师{" "}
            <small>
              {d.plan
                ? hasActivity
                  ? "进度已更新 · 原安排已保存"
                  : "今天的安排已保存"
                : d.configured
                  ? "正在为你准备"
                  : "你的学习伙伴"}
            </small>
          </span>
        </div>
        <h2>
          {salutation}，{name}
        </h2>
        {d.loading || (!d.plan && d.busy) ? (
          <p className="daily-wait" role="status">
            <LoaderCircle className="spin" size={17} />
            正在结合学习记录安排今天的小目标…
          </p>
        ) : (
          <>
            <p className="daily-greeting">
              {liveGreeting ??
                d.plan?.greeting ??
                "先从一个小问题开始。你可以继续上次的任务，或选择一门语言；连接AI后，我会结合你的记录安排学习。"}
            </p>
            {!hasActivity && d.plan?.question && (
              <p className="daily-question">{d.plan.question}</p>
            )}
            {hasActivity && d.plan && (
              <details className="daily-original">
                <summary>查看最初的安排说明</summary>
                <p>{d.plan.greeting}</p>
              </details>
            )}
            {complete ? (
              <button
                className="button primary"
                disabled={d.busy || m.busy || starting}
                onClick={() =>
                  resume ? onOpen(m.active!.lessonId) : void next()
                }
              >
                {starting
                  ? "正在安排…"
                  : resume
                    ? "继续当前任务"
                    : "让AI安排下一小步"}
                <ArrowRight size={15} />
              </button>
            ) : (
              hasActivity && (
                <button
                  className="button primary"
                  disabled={d.busy || starting}
                  onClick={() =>
                    resume
                      ? onOpen(m.active!.lessonId)
                      : void start(Math.max(0, nextIndex))
                  }
                >
                  继续学习
                  <ArrowRight size={15} />
                </button>
              )
            )}
          </>
        )}
        {d.plan && (
          <>
            <div className="daily-time" aria-label="今天的学习时间">
              {[10, 20, 35].map((n) => (
                <button
                  key={n}
                  disabled={d.busy || starting}
                  aria-pressed={d.plan?.budget === n}
                  onClick={() => void d.prepare({ minutes: n })}
                >
                  {n}分钟
                </button>
              ))}
              <select
                aria-label="今日学习语言"
                value={d.plan.language}
                disabled={d.busy || starting}
                onChange={(e) =>
                  void d.prepare({ language: e.target.value as Language })
                }
              >
                <option value="c">C语言</option>
                <option value="cpp">C++</option>
                <option value="python">Python</option>
              </select>
            </div>
            <form
              className="daily-reply"
              onSubmit={(e) => {
                e.preventDefault();
                void reply();
              }}
            >
              <input
                aria-label="告诉AI今天的想法"
                value={message}
                maxLength={500}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="今天哪里没懂，或者想调整安排…"
              />
              <button
                aria-label="回应今日AI老师"
                disabled={d.busy || !message.trim()}
              >
                <Send size={16} />
              </button>
            </form>
          </>
        )}
        {(d.error || m.error) && (
          <p className="daily-error" role="alert">
            {d.error || m.error}
            <button disabled={d.busy} onClick={() => message.trim() ? void reply() : void d.prepare()}>
              {message.trim() ? "重试这次调整" : "重新读取安排"}
            </button>
          </p>
        )}
      </div>
      <div className="daily-agenda">
        <div className="daily-agenda-title">
          <b>今天从这里开始</b>
          {d.plan && (
            <small>
              共{d.plan.steps.reduce((n, s) => n + s.minutes, 0)}分钟 ·
              按实际进度推进
            </small>
          )}
        </div>
        {d.plan ? (
          <ol>
            {d.plan.steps.map((step, index) => (
              <li key={step.lessonId}>
                <div>
                  <strong>{step.title}</strong>
                  <small>
                    {step.minutes}分钟 · {d.progress?.[index]?.text ?? "待开始"}
                  </small>
                  <p>{step.reason}</p>
                </div>
                <button
                  disabled={
                    d.busy ||
                    starting ||
                    !!(
                      d.progress?.[index]?.state !== "verified" &&
                      m.active &&
                      m.active.goal.language === d.plan?.language &&
                      m.active.lessonId !== step.lessonId &&
                      !m.progress?.canAdvance &&
                      step.kind !== "review"
                    )
                  }
                  aria-label={
                    (d.progress?.[index]?.state === "verified" ? "回看" : "开始") +
                    "今日安排：" + step.title
                  }
                  onClick={() => void start(index)}
                >
                  {d.progress?.[index]?.state === "verified"
                    ? "回看"
                    : d.progress?.[index]?.state === "coding" ||
                        d.progress?.[index]?.state === "opened"
                      ? "继续"
                      : index === nextIndex ? "开始" : "之后"}
                  <ArrowRight size={15} />
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p>
            已有课程、草稿和当前任务都保留在下方。
            {d.configured === false ? "可在AI连接设置中连接老师。" : ""}
          </p>
        )}
        {d.busy && d.plan && (
          <p role="status" className="daily-wait">
            <LoaderCircle size={14} className="spin" />
            正在调整，原计划仍然保留…
          </p>
        )}
      </div>
    </section>
  );
}
