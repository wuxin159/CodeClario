import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Compass,
  LoaderCircle,
  Target,
} from "lucide-react";
import { findLesson, languages, type Language } from "../../shared/curriculum";
import { entryQuestions, type LearningGoal } from "../../shared/mission";
import type { PublicUser } from "../../shared/account";
import type { Missions } from "../hooks/useMissions";
import AIConnection from "./AIConnection";
import DailyWelcome from "./DailyWelcome";
import { useDailyPlan } from "../hooks/useDailyPlan";

export const phaseNames = {
  predict: "表达预期",
  run: "真实验证",
  revise: "分析与修正",
  retest: "独立检验",
  ready: "本次验证完成",
};
export default function TaskHome({
  missions: m,
  user,
  onFlush,
  onOpen,
  onCourses,
  onRecords,
  onRequireAuth,
}: {
  missions: Missions;
  user: PublicUser | null;
  onFlush: () => Promise<unknown>;
  onOpen: (id: string) => void;
  onCourses: () => void;
  onRecords: () => void;
  onRequireAuth: () => void;
}) {
  const [editing, setEditing] = useState(false),
    [language, setLanguage] = useState<Language>("python"),
    [aim, setAim] = useState("从基础开始，学会独立读懂和修改代码"),
    [experience, setExperience] = useState<LearningGoal["experience"]>("new"),
    [diagnostic, setDiagnostic] = useState<number | null>(null);
  const active = m.active,
    lesson = active ? findLesson(active.lessonId) : null,
    question = entryQuestions[language];
  const daily = useDailyPlan(user?.id);
  const dailyLeads =
    !active && !editing && (daily.loading || daily.busy || !!daily.plan);
  const configure = !active || editing;
  const [localError, setLocalError] = useState("");
  return (
    <main className="page-content task-home">
      <div className="task-home-heading">
        <div>
          <h1>我的学习</h1>
          <p>
            {active
              ? m.progress?.canAdvance
                ? "这次练习已完成验证，可以继续下一项。"
                : "接着上次的问题，完成这一次练习。"
              : daily.plan
                ? "AI已经准备好今天的安排，先从一小步开始。"
                : "选择目标与起点，开始一项可验证的任务。"}
          </p>
        </div>
        <span className="home-date">
          {new Intl.DateTimeFormat("zh-CN", {
            month: "long",
            day: "numeric",
            weekday: "long",
          }).format(new Date())}
        </span>
      </div>
      {user && (
        <DailyWelcome
          daily={daily}
          missions={m}
          name={user.displayName}
          onOpen={onOpen}
          onFlush={onFlush}
        />
      )}
      {dailyLeads ? (
        <div className="daily-manual">
          <button className="text-button" onClick={() => setEditing(true)}>
            自行设置学习目标
          </button>
          <button className="text-button" onClick={onCourses}>
            自主选择课程
          </button>
        </div>
      ) : (
        <div className="task-home-columns">
          <section className="task-home-primary">
            {m.loading ? (
              <div className="task-loading">
                <LoaderCircle className="spin" />
                正在恢复学习任务…
              </div>
            ) : configure ? (
              <>
                <div className="task-kicker">
                  <span className="brand-mark" aria-hidden="true" />
                  学习起点
                </div>
                <h2>从你的学习目标开始</h2>
                <p className="task-intro">
                  选一个目标，做一道简短预测。AI会结合你的记录，安排具体任务。
                </p>
                <form
                  className="goal-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!user) {
                      onRequireAuth();
                      return;
                    }
                    const result = await m.plan({
                      language,
                      aim,
                      experience,
                      diagnostic,
                    });
                    if (result) {
                      setEditing(false);
                      if (daily.configured) void daily.prepare({ language });
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  }}
                >
                  <fieldset disabled={m.busy}>
                    <legend>编程语言</legend>
                    <div className="goal-languages">
                      {languages.map((l) => (
                        <label
                          key={l.id}
                          className={language === l.id ? "selected" : ""}
                        >
                          <input
                            type="radio"
                            name="goal-language"
                            value={l.id}
                            checked={language === l.id}
                            onChange={() => {
                              setLanguage(l.id);
                              setDiagnostic(null);
                            }}
                          />
                          {l.name}
                        </label>
                      ))}
                    </div>
                    <label>
                      学习目标
                      <input
                        aria-label="学习目标"
                        value={aim}
                        required
                        maxLength={200}
                        onChange={(e) => setAim(e.target.value)}
                      />
                    </label>
                    <label>
                      目前的起点
                      <select
                        aria-label="目前的起点"
                        value={experience}
                        onChange={(e) =>
                          setExperience(e.target.value as typeof experience)
                        }
                      >
                        <option value="new">刚开始接触编程</option>
                        <option value="some">写过一些代码，想查漏补缺</option>
                      </select>
                    </label>
                    <div className="entry-diagnostic">
                      <div>
                        <b>先试着读一小段</b>
                        <span>起点诊断 · 不计成绩</span>
                      </div>
                      <pre>{question.code}</pre>
                      <p>你认为最终会输出什么？</p>
                      <div>
                        {question.options.map((o, i) => (
                          <label key={i}>
                            <input
                              type="radio"
                              name="entry-answer"
                              checked={diagnostic === i}
                              onChange={() => setDiagnostic(i)}
                              required
                            />
                            {o}
                          </label>
                        ))}
                      </div>
                    </div>
                  </fieldset>
                  <div className="goal-actions">
                    <button
                      className="button primary"
                      disabled={m.busy || diagnostic === null}
                    >
                      {m.busy ? (
                        <LoaderCircle className="spin" size={17} />
                      ) : (
                        <Target size={17} />
                      )}{" "}
                      {m.busy ? "AI正在选择任务…" : "让AI安排学习任务"}
                      <ArrowRight size={16} />
                    </button>
                    {editing && (
                      <button
                        type="button"
                        onClick={() => setEditing(false)}
                        disabled={m.busy}
                      >
                        保留当前任务
                      </button>
                    )}
                    {m.busy && (
                      <button type="button" onClick={m.stop}>
                        停止
                      </button>
                    )}
                  </div>
                </form>
              </>
            ) : (
              <>
                <div className="task-kicker">
                  <span className="brand-mark" aria-hidden="true" />
                  {active.source === "deepseek"
                    ? "AI安排的当前任务"
                    : "自主选择的当前任务"}
                  <span className="task-status">
                    {m.progress?.canAdvance ? "待继续" : "进行中"}
                  </span>
                </div>
                <div className="task-home-title">
                  <small>
                    {lesson?.language === "c"
                      ? "C 语言"
                      : lesson?.language === "cpp"
                        ? "C++"
                        : "Python"}{" "}
                    / {lesson?.title}
                  </small>
                  <h2>{active.title}</h2>
                  <p>{lesson?.task ?? active.objective}</p>
                </div>
                <div className="home-active-actions">
                  {!m.progress?.canAdvance && (
                    <button
                      className="button primary"
                      onClick={() => onOpen(active.lessonId)}
                    >
                      继续这个任务
                      <ArrowRight size={17} />
                    </button>
                  )}
                  {m.progress?.canAdvance && (
                    <button
                      className="button primary"
                      disabled={m.busy}
                      onClick={() =>
                        void (async () => {
                          setLocalError("");
                          try {
                            await onFlush();
                            await m.advance();
                          } catch (e) {
                            setLocalError((e as Error).message);
                          }
                        })()
                      }
                    >
                      {m.busy ? "AI正在安排…" : "完成任务，AI安排下一项"}
                    </button>
                  )}
                  {m.progress?.canAdvance && (
                    <button
                      className="button secondary"
                      onClick={() => onOpen(active.lessonId)}
                    >
                      回看这个任务
                    </button>
                  )}
                  <button
                    className="text-button"
                    disabled={m.busy}
                    onClick={() => {
                      setLanguage(active.goal.language);
                      setAim(active.goal.aim);
                      setExperience(active.goal.experience);
                      setDiagnostic(active.goal.diagnostic);
                      setEditing(true);
                    }}
                  >
                    调整学习目标
                  </button>
                </div>
                <div className="task-reason">
                  <Target size={18} />
                  <div>
                    <b>为什么现在做这个</b>
                    <p>{active.reason}</p>
                  </div>
                </div>
                <details className="home-prerequisites">
                  <summary>任务依据与建议基础</summary>
                  <p>学习目标：{active.goal.aim}</p>
                  <p>
                    建议基础：
                    {active.prerequisites.join("、") || "无需额外基础"}
                  </p>
                  <p>
                    选择依据：
                    {active.evidence
                      .map((id) =>
                        id === "goal"
                          ? "你的学习目标"
                          : id === "diagnostic"
                            ? "起点作答"
                            : id === "completion"
                              ? "刚完成的练习结果"
                              : id === "learner"
                                ? "自主选择"
                                : "历史练习记录",
                      )
                      .join("、")}
                  </p>
                </details>
                <div className="home-task-track">
                  {["表达预期", "真实验证", "分析与修正", "独立检验"].map(
                    (s, i) => (
                      <div
                        key={s}
                        className={
                          [
                            "predict",
                            "run",
                            "revise",
                            "retest",
                            "ready",
                          ].indexOf(m.progress?.phase ?? "predict") >= i
                            ? "reached"
                            : ""
                        }
                      >
                        <span>{i + 1}</span>
                        <b>{s}</b>
                      </div>
                    ),
                  )}
                </div>
                {m.progress?.episode && (
                  <div className="task-home-evidence">
                    <span>当前进度 · {phaseNames[m.progress.phase]}</span>
                    <p>
                      {m.progress.stale
                        ? "草稿已修改，需要重新运行验证。"
                        : (m.progress.episode.decision?.question ??
                          m.progress.episode.decision?.summary ??
                          "学习记录已保存，进入课程实践继续。")}
                    </p>
                  </div>
                )}
              </>
            )}
            {(m.error || localError) && (
              <div className="mission-error" role="alert">
                {m.error || localError}
              </div>
            )}
            {!m.loading && !m.configured && user && (
              <p className="task-connection-note">
                AI尚未连接。连接后可安排任务；课程与运行仍可使用。
              </p>
            )}
            <AIConnection
              userId={user?.id}
              onSaved={() => void m.refresh()}
              onRequireAuth={onRequireAuth}
            />
          </section>
          <aside className="task-home-aside">
            <section className="task-side-card">
              <h2>这次练习的记录</h2>
              {m.progress?.episode ? (
                <dl>
                  <dt>当前阶段</dt>
                  <dd>{phaseNames[m.progress.phase]}</dd>
                  <dt>我的预测</dt>
                  <dd>
                    {m.progress.episode.prediction
                      ? m.progress.episode.prediction.value || "（无输出）"
                      : "尚未记录"}
                  </dd>
                  <dt>实测核对</dt>
                  <dd className="current-evidence">
                    {m.progress.stale
                      ? "代码已修改，待重新运行"
                      : (m.progress.episode.comparison?.actual ??
                        (m.progress.episode.attemptId
                          ? "已有运行记录"
                          : "等待真实运行"))}
                  </dd>
                  <dt>理解检验</dt>
                  <dd>
                    {m.progress.verification === "independent"
                      ? "独立迁移题通过"
                      : m.progress.verification === "assisted"
                        ? "AI辅助后通过"
                        : m.progress.verification === "corrected"
                          ? "参考解析后订正"
                          : m.progress.verification === "course"
                            ? "课程理解题通过"
                            : m.progress.canAdvance
                              ? "已完成理解检验"
                              : "等待检验"}
                  </dd>
                </dl>
              ) : (
                <>
                  <p>保存预测并运行后，实际结果与理解检查会记录在这里。</p>
                  <h3>从入门开始</h3>
                  <p>C、C++、Python各18节课程。先读懂一小段，再编写和验证。</p>
                </>
              )}
            </section>
            <button className="resource-entry" onClick={onCourses}>
              <BookOpen />
              <div>
                <b>课程中心</b>
                <span>54节课程 · C / C++ / Python</span>
              </div>
              <ChevronRight size={17} />
            </button>
            <button className="resource-entry" onClick={onRecords}>
              <Compass />
              <div>
                <b>学习记录</b>
                <span>回看预测、运行、修正与复测</span>
              </div>
              <ChevronRight size={17} />
            </button>
          </aside>
        </div>
      )}
      {!!m.recent.length && (
        <section className="mission-recent">
          <div className="section-heading">
            <h2>最近的学习任务</h2>
            <button onClick={onRecords}>
              查看全部学习记录
              <ArrowRight size={14} />
            </button>
          </div>
          <div>
            {m.recent.slice(0, 3).map((t) => (
              <button key={t.id} onClick={() => onOpen(t.lessonId)}>
                <span className="recent-status">
                  {t.status === "completed" ? (
                    <Check size={16} />
                  ) : (
                    <BookOpen size={16} />
                  )}
                </span>
                <div>
                  <b>{t.title}</b>
                  <small>
                    {findLesson(t.lessonId)?.title} ·{" "}
                    {t.status === "completed"
                      ? "本次验证完成"
                      : "已暂停 · 可重新练习"}
                  </small>
                </div>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
        </section>
      )}
      <footer className="page-footer">
        <span>代码灵 · CodeClario</span>
        <span>C17 · C++17 · Python 3</span>
      </footer>
    </main>
  );
}
