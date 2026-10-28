import { useEffect, useRef, useState, type ReactNode } from "react";
import BrandIdentity from "./components/BrandIdentity";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Clock3,
  Code2,
  Compass,
  Flame,
  GraduationCap,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  MoreHorizontal,
  Search,
  Target,
  Terminal,
  Trophy,
  X,
} from "lucide-react";
import {
  languages,
  lessons,
  findLesson,
  coursePosition,
  type Language,
  type RunResult,
} from "../shared/curriculum";

import AccountDialog from "./components/AccountDialog";
import Workspace from "./components/LearningWorkspace";
import StudyOverview from "./components/StudyOverview";
import FlowOverview from "./components/FlowOverview";
import AttemptDetail from "./components/AttemptDetail";
import RunHistory from "./components/RunHistory";
import { teachingPlan, studyStatus } from "../shared/teaching";
import { useLearningAccount } from "./hooks/useLearningAccount";
import { useMissions } from "./hooks/useMissions";
import TaskHome from "./components/TaskHome";
import MissionHistory from "./components/MissionHistory";
import LandingPage from "./components/LandingPage";

type Page = "home" | "dashboard" | "courses" | "lab" | "progress";
const dateKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const langName = (id: Language) =>
  languages.find((item) => item.id === id)!.name;
const navItems = [
  { id: "dashboard" as Page, title: "我的学习", icon: LayoutDashboard },
  { id: "courses" as Page, title: "课程中心", icon: Compass },
  { id: "lab" as Page, title: "课程实践", icon: Code2 },
  { id: "progress" as Page, title: "学习记录", icon: GraduationCap },
];

function LanguageMark({
  language,
  small = false,
}: {
  language: Language;
  small?: boolean;
}) {
  return (
    <span className={`language-mark ${language} ${small ? "small" : ""}`}>
      {language === "c" ? (
        "C"
      ) : language === "cpp" ? (
        <span>
          C<sup>++</sup>
        </span>
      ) : (
        <span className="python-mark">
          <i />
          <i />
        </span>
      )}
    </span>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>(() => {
    const value = location.hash.slice(1).split("/")[0];
    return navItems.some((item) => item.id === value)
      ? (value as Page)
      : "home";
  });
  const account = useLearningAccount();
  const { state, setState, user } = account;
  const missions = useMissions(user?.id);
  useEffect(() => {
    void missions.refresh();
  }, [page, user?.id]);
  const [accountDialog, setAccountDialog] = useState<{
    mode: "login" | "register" | "profile";
    reason?: string;
  } | null>(null);
  const avatar = Array.from(user?.displayName || "访")[0].toUpperCase();
  const boundAccount = useRef<string | null | undefined>(undefined);
  const pendingDestination = useRef<{ page: Page; lessonId?: string } | null>(
    null,
  );
  const [lessonId, setLessonId] = useState(() => {
    const path = location.hash.split("/")[1];
    return findLesson(path)?.id || "c-1";
  });
  const [status, setStatus] = useState({
    runner: false,
    ai: false,
    model: "",
    checked: false,
  });
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState<Language | "all">("all");
  const [chapter, setChapter] = useState("all");
  const [toast, setToast] = useState("");
  const [attemptDetail, setAttemptDetail] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const currentLesson = findLesson(lessonId) || lessons[0];
  const activeDays = state.totals.activeDays;
  const progress = Math.round((state.completed.length / lessons.length) * 100);
  const nextLesson = findLesson(state.lastLesson) || lessons[0];

  useEffect(() => {
    if (account.loading) return;
    const id = user?.id ?? null;
    const previousAccount = boundAccount.current;
    if (previousAccount !== undefined && previousAccount !== id) {
      // The selected lesson is public context. Account-owned drafts and results
      // are reset by the account hook and workspace key, not by redirecting it.
      setQuery("");
      setSearchOpen(false);
      setMobileNav(false);
    }
    boundAccount.current = id;
    if (!id && page !== "home") {
      pendingDestination.current = previousAccount ? null : { page, lessonId };
      setPage("home");
      if (previousAccount) setAccountDialog(null);
      else
        setAccountDialog({
          mode: "login",
          reason: "登录后继续你的学习任务，代码和记录会保存在当前账户中。",
        });
    }
  }, [user?.id, account.loading, page, lessonId]);
  useEffect(() => {
    if (!account.loading && user && page === "lab") {
      setState((previous) =>
        previous.lastLesson === lessonId
          ? previous
          : { ...previous, lastLesson: lessonId },
      );
    }
  }, [account.loading, user?.id, page, lessonId, setState]);
  useEffect(() => {
    if (page !== "home" || !location.hash.startsWith("#home/"))
      location.hash = page === "lab" ? `lab/${lessonId}` : page;
    document.title =
      page === "home"
        ? "代码灵 · CodeClario｜看见执行，学懂代码"
        : `${page === "lab" ? currentLesson.title : navItems.find((item) => item.id === page)!.title} | 代码灵 · CodeClario`;
  }, [page, lessonId]);
  useEffect(() => {
    const listener = () => {
      const [value, id] = location.hash.slice(1).split("/");
      if (value === "home" || navItems.some((item) => item.id === value))
        setPage(value as Page);
      if (findLesson(id)) setLessonId(id);
    };
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/status", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => setStatus({ ...data, checked: true }))
      .catch(() => {
        if (!controller.signal.aborted)
          setStatus({ runner: false, ai: false, model: "", checked: true });
      });
    return () => controller.abort();
  }, [user?.id, page === "lab"]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 3200);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((value) => !value);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setHelpOpen(false);
        setNotifications(false);
        setMobileNav(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function navigate(value: Page) {
    setPage(value);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function openLesson(id: string) {
    setLessonId(id);
    setState((value) => ({ ...value, lastLesson: id }));
    navigate("lab");
    setSearchOpen(false);
    setQuery("");
  }
  function recordRun(_result: RunResult) {
    if (user)
      void account
        .refreshLearning(user.id)
        .catch((error) => setToast(error.message));
  }
  if (account.loading)
    return (
      <div className="session-loading">
        <LoaderCircle className="spin" size={24} />
        <span>正在读取账户…</span>
      </div>
    );
  const searched = lessons.filter((item) =>
    `${item.title} ${item.concepts.join(" ")} ${teachingPlan(item).chapter} ${langName(item.language)}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const authModal = accountDialog ? (
    <AccountDialog
      key={`${user?.id || "guest"}:${accountDialog.mode}`}
      user={user}
      initialMode={accountDialog.mode}
      reason={accountDialog.reason}
      actions={account}
      onClose={() => setAccountDialog(null)}
      onSuccess={(message) => {
        setToast(message);
        if (accountDialog.mode !== "profile") {
          const target = pendingDestination.current;
          if (target?.lessonId) setLessonId(target.lessonId);
          navigate(target?.page ?? "dashboard");
          pendingDestination.current = null;
        }
      }}
    />
  ) : null;
  if (page === "home" || !user)
    return (
      <>
        <LandingPage
          authenticated={!!user}
          onEnter={() => {
            if (user) navigate("dashboard");
            else {
              pendingDestination.current = { page: "dashboard" };
              setAccountDialog({ mode: "login" });
            }
          }}
        />
        {authModal}
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </>
    );

  return (
    <div className={`app-shell ${page === "lab" ? "is-workspace" : ""}`}>
      {mobileNav && (
        <div className="sidebar-scrim" onClick={() => setMobileNav(false)} />
      )}
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <a
          href="#home"
          aria-label="代码灵 · CodeClario 网站主页"
          className="brand"
          onClick={() => navigate("home")}
        >
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-copy">
            <BrandIdentity />
          </span>
        </a>
        <div className="sidebar-label">你的学习空间</div>
        <nav aria-label="主导航">
          {navItems.map((item) => (
            <button
              key={item.id}
              aria-label={item.title}
              title={item.title}
              className={`nav-item ${page === item.id ? "active" : ""}`}
              onClick={() =>
                item.id === "lab"
                  ? openLesson(missions.active?.lessonId ?? state.lastLesson)
                  : navigate(item.id)
              }
            >
              <item.icon size={19} strokeWidth={1.8} />
              <span>{item.title}</span>

              {page === item.id && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar-course">
          <span>最近学习</span>
          <button onClick={() => openLesson(nextLesson.id)}>
            <LanguageMark language={nextLesson.language} small />
            <div>
              <b>{nextLesson.title}</b>
              <small>
                {
                  state.completed.filter((id) =>
                    id.startsWith(`${nextLesson.language}-`),
                  ).length
                }{" "}
                /{" "}
                {
                  lessons.filter((l) => l.language === nextLesson.language)
                    .length
                }{" "}
                节已完成
              </small>
            </div>
            <ChevronRight size={15} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <div className="growth-card">
            <b>学习记录</b>
            <p>
              {user
                ? `已完成 ${state.completed.length} / ${lessons.length} 节基础课程。`
                : "登录后，代码草稿和练习记录会保存到你的账户。"}
            </p>
            <button
              onClick={() =>
                user
                  ? navigate("progress")
                  : setAccountDialog({ mode: "login" })
              }
            >
              {user ? "查看学习记录" : "登录账户"}
              <ArrowRight size={14} />
            </button>
          </div>
          <button className="help-link" onClick={() => setHelpOpen(true)}>
            <CircleHelp size={18} /> 学习指南 <ArrowUpRight size={15} />
          </button>
          <button
            className="profile"
            onClick={() =>
              setAccountDialog({ mode: user ? "profile" : "login" })
            }
          >
            <span className="avatar">{avatar}</span>
            <div>
              <b>{user?.displayName || "访客"}</b>
              <small>{user ? `@${user.username}` : "登录以保存学习记录"}</small>
            </div>
            <MoreHorizontal size={18} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              onClick={() => setMobileNav(true)}
              aria-label="打开导航"
            >
              <Menu size={21} />
            </button>
            <span>学习空间</span>
            <ChevronRight size={13} />
            <b>{navItems.find((item) => item.id === page)!.title}</b>
          </div>
          <div className="topbar-right">
            <button
              className="search-trigger"
              aria-label="搜索课程"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={16} />
              <span>搜索课程、知识点…</span>
              <kbd>Ctrl K</kbd>
            </button>
            <span className="topbar-divider" />
            <div className="notification-wrap">
              <button
                className="icon-button"
                aria-label="学习提醒"
                onClick={() => setNotifications((value) => !value)}
              >
                <Bell size={19} />
              </button>
              {notifications && (
                <div className="notification-popover">
                  <b>学习提醒</b>
                  {!user ? (
                    <>
                      <p>登录后查看自己的复习提醒与最近课程。</p>
                      <button
                        onClick={() => {
                          setNotifications(false);
                          setAccountDialog({ mode: "login" });
                        }}
                      >
                        登录账户
                      </button>
                    </>
                  ) : (
                    <>
                      {account.saveStatus === "error" && (
                        <button
                          onClick={() => {
                            setNotifications(false);
                            void account
                              .flush()
                              .catch((error) => setToast(error.message));
                          }}
                        >
                          草稿尚未保存，点击重试
                        </button>
                      )}
                      {Object.entries(state.study)
                        .filter(
                          ([id, r]) =>
                            findLesson(id) && r.review && !r.review.correct,
                        )
                        .slice(0, 3)
                        .map(([id]) => (
                          <button
                            key={id}
                            onClick={() => {
                              setNotifications(false);
                              openLesson(id);
                            }}
                          >
                            待复核：{langName(findLesson(id)!.language)} ·{" "}
                            {findLesson(id)!.title}
                            <ArrowRight size={13} />
                          </button>
                        ))}
                      {!Object.values(state.study).some(
                        (r) => r.review && !r.review.correct,
                      ) && <p>目前没有未通过的理解检查。</p>}
                      <button
                        onClick={() => {
                          setNotifications(false);
                          openLesson(nextLesson.id);
                        }}
                      >
                        继续：{nextLesson.title}
                        <ArrowRight size={13} />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            {user ? (
              <button
                className="account-topbar-user"
                aria-label="账户设置"
                onClick={() => setAccountDialog({ mode: "profile" })}
              >
                <span className="avatar small-avatar">{avatar}</span>
                <span>{user.displayName}</span>
              </button>
            ) : (
              <div className="account-topbar-actions">
                <button onClick={() => setAccountDialog({ mode: "login" })}>
                  登录
                </button>
                <button
                  className="register-trigger"
                  onClick={() => setAccountDialog({ mode: "register" })}
                >
                  注册
                </button>
              </div>
            )}
          </div>
        </header>

        {account.error && (
          <div className="save-error-banner" role="alert">
            {account.error}
            <button onClick={() => void account.flush().catch(() => {})}>
              重试保存
            </button>
          </div>
        )}
        {page === "dashboard" && (
          <TaskHome
            key={user?.id ?? "guest"}
            missions={missions}
            user={user}
            onFlush={account.flush}
            onOpen={openLesson}
            onCourses={() => navigate("courses")}
            onRecords={() => navigate("progress")}
            onRequireAuth={() => setAccountDialog({ mode: "login" })}
          />
        )}

        {page === "courses" && (
          <main className="page-content courses-page">
            <div className="eyebrow">课程目录</div>
            <h1>课程目录</h1>
            <p className="page-description">
              按语言选择课程，学习基础语法并完成对应练习。
            </p>
            <div className="course-grid">
              {languages.map((language) => (
                <CourseCard
                  key={language.id}
                  language={language.id}
                  completed={state.completed}
                  actionLabel={`查看${language.name}课程`}
                  onOpen={() => {
                    setFilter(language.id);
                    setChapter("all");
                    setQuery("");
                    document
                      .getElementById("lesson-list")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                />
              ))}
            </div>
            <section className="course-catalog panel" id="lesson-list">
              <div className="section-heading">
                <div>
                  <h2>基础课程</h2>
                  <p>按顺序学习，也可以直接进入需要练习的章节。</p>
                </div>
                <span className="catalog-count">
                  {lessons.length} 节基础课程
                </span>
              </div>
              <div className="catalog-toolbar">
                <div className="filter-tabs" aria-label="课程语言筛选">
                  {[{ id: "all", name: "全部语言" }, ...languages].map(
                    (language) => (
                      <button
                        key={language.id}
                        className={filter === language.id ? "selected" : ""}
                        onClick={() => {
                          setFilter(language.id as Language | "all");
                          setChapter("all");
                        }}
                      >
                        {language.name}
                      </button>
                    ),
                  )}
                </div>
                <label className="catalog-search">
                  <Search size={16} />
                  <input
                    placeholder="搜索知识点或课程"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
              </div>
              <div className="chapter-filter">
                <label>
                  知识模块
                  <select
                    aria-label="筛选知识模块"
                    value={chapter}
                    onChange={(e) => setChapter(e.target.value)}
                  >
                    <option value="all">全部模块</option>
                    {[
                      ...new Set(
                        lessons
                          .filter(
                            (item) =>
                              filter === "all" || item.language === filter,
                          )
                          .map((item) => teachingPlan(item).chapter),
                      ),
                    ].map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <span>
                  {
                    searched.filter(
                      (item) =>
                        (filter === "all" || item.language === filter) &&
                        (chapter === "all" ||
                          teachingPlan(item).chapter === chapter),
                    ).length
                  }{" "}
                  节匹配课程 · 每课包含讲解、概念演示、理解检查与编码练习
                </span>
              </div>
              <div className="lesson-list">
                {searched
                  .filter(
                    (item) =>
                      (filter === "all" || item.language === filter) &&
                      (chapter === "all" ||
                        teachingPlan(item).chapter === chapter),
                  )
                  .map((lesson) => (
                    <button
                      className="lesson-row"
                      key={lesson.id}
                      onClick={() => openLesson(lesson.id)}
                    >
                      <span
                        className={`lesson-order ${state.completed.includes(lesson.id) ? "done" : ""}`}
                      >
                        {state.completed.includes(lesson.id) ? (
                          <Check size={17} />
                        ) : (
                          String(coursePosition(lesson) + 1).padStart(2, "0")
                        )}
                      </span>
                      <LanguageMark language={lesson.language} small />
                      <div className="lesson-title">
                        <b>{lesson.title}</b>
                        <span>
                          {teachingPlan(lesson).chapter} ·{" "}
                          {lesson.concepts.join(" · ")}
                        </span>
                        <small className="catalog-study-state">
                          {teachingPlan(lesson).visualTitle} ·{" "}
                          {studyStatus(state.study[lesson.id])}
                        </small>
                      </div>
                      <span className="lesson-language">
                        {langName(lesson.language)}
                      </span>
                      <span className="lesson-duration">
                        <Clock3 size={14} />
                        {lesson.minutes} 分钟
                      </span>
                      <span className="lesson-open">
                        {state.completed.includes(lesson.id)
                          ? "再次练习"
                          : "开始学习"}
                        <ArrowRight size={15} />
                      </span>
                    </button>
                  ))}
                {!searched.filter(
                  (item) =>
                    (filter === "all" || item.language === filter) &&
                    (chapter === "all" ||
                      teachingPlan(item).chapter === chapter),
                ).length && (
                  <div className="empty-state">
                    <Search size={30} />
                    <h3>没有匹配的课程</h3>
                    <p>试试“循环”“数组”或“Python”。</p>
                    <button
                      className="button secondary"
                      onClick={() => {
                        setQuery("");
                        setFilter("all");
                        setChapter("all");
                      }}
                    >
                      查看全部课程
                    </button>
                  </div>
                )}
              </div>
            </section>
          </main>
        )}

        {page === "lab" && (
          <Workspace
            key={`${user?.id || "guest"}:${currentLesson.id}`}
            lesson={currentLesson}
            missions={missions}
            onHome={() => navigate("dashboard")}
            onFlush={account.flush}
            draft={state.drafts[currentLesson.id] ?? currentLesson.starter}
            savedInput={state.inputs[currentLesson.id] ?? currentLesson.stdin}
            onDraft={(code) =>
              setState((value) => ({
                ...value,
                drafts: { ...value.drafts, [currentLesson.id]: code },
              }))
            }
            onInput={(input) =>
              setState((value) => ({
                ...value,
                inputs: { ...value.inputs, [currentLesson.id]: input },
              }))
            }
            onOpen={openLesson}
            onBack={() => navigate("courses")}
            onRun={recordRun}
            study={state.study[currentLesson.id]}
            onStudyChange={() => {
              if (user)
                void account
                  .refreshLearning(user.id)
                  .catch((error) => setToast(error.message));
            }}
            completed={state.completed}
            status={status}
            notify={setToast}
            userId={user?.id}
            onRequireAuth={() =>
              setAccountDialog({
                mode: "login",
                reason:
                  "登录后可以运行代码、使用助教，并将练习记录保存到你的账户。",
              })
            }
            saveStatus={account.saveStatus}
            onSaveRetry={() => {
              if (!user) setAccountDialog({ mode: "login" });
              else
                void account.flush().catch((error) => setToast(error.message));
            }}
          />
        )}

        {page === "progress" && (
          <main className="page-content progress-page">
            <div className="eyebrow">练习统计</div>
            <h1>学习记录</h1>
            <p className="page-description">
              查看当前账户的课程进度、运行次数与最近练习。
            </p>
            <div className="stats-grid">
              <Stat
                icon={<BookOpen />}
                label="完成的课程"
                value={state.completed.length}
                suffix="节"
                detail="通过样例检查的学习任务"
                color="green"
              />
              <Stat
                icon={<Terminal />}
                label="累计运行"
                value={state.totals.runs}
                suffix="次"
                detail="包含通过与未通过的运行"
                color="blue"
              />
              <Stat
                icon={<Flame />}
                label="活跃学习"
                value={activeDays}
                suffix="天"
                detail="按有运行记录的日期统计"
                color="orange"
              />
              <Stat
                icon={<Trophy />}
                label="样例通过"
                value={state.totals.passed}
                suffix="次"
                detail="通过全部样例的运行次数"
                color="purple"
              />
            </div>
            <div className="learning-record-panels">
              <MissionHistory
                missions={missions}
                userId={user?.id}
                onOpen={openLesson}
              />
              <FlowOverview
                key={user?.id}
                userId={user?.id}
                onOpen={openLesson}
              />
            </div>
            <div className="progress-columns">
              <section className="panel progress-paths">
                <h2>学习路径进度</h2>
                {languages.map((language) => {
                  const count = state.completed.filter((id) =>
                    id.startsWith(`${language.id}-`),
                  ).length;
                  return (
                    <button
                      className="progress-language"
                      key={language.id}
                      onClick={() => openLesson(`${language.id}-1`)}
                    >
                      <LanguageMark language={language.id} />
                      <div>
                        <b>{language.name} 基础课程</b>
                        <div className="progress-track">
                          <i
                            style={{
                              width: `${(count / lessons.filter((l) => l.language === language.id).length) * 100}%`,
                            }}
                          />
                        </div>
                        <small>
                          {count} /{" "}
                          {
                            lessons.filter((l) => l.language === language.id)
                              .length
                          }{" "}
                          节已完成
                        </small>
                      </div>
                      <ArrowUpRight size={18} />
                    </button>
                  );
                })}
                <div className="progress-note">
                  <CheckCheck size={20} />
                  <span>学习记录保存在当前账户中，重新登录后可继续。</span>
                </div>
              </section>
              <section className="panel activity-panel">
                <div className="section-heading compact">
                  <h2>最近七天</h2>
                  <span className="tiny-label">学习节奏</span>
                </div>
                <div className="activity-chart">
                  {Array.from({ length: 7 }, (_, index) => {
                    const date = new Date();
                    date.setDate(date.getDate() - 6 + index);
                    const count = state.activity[dateKey(date)] || 0;
                    return (
                      <div className="activity-column" key={index}>
                        <small>{count || ""}</small>
                        <span
                          style={{
                            height: `${Math.max(5, Math.min(count * 15, 130))}px`,
                          }}
                          className={count ? "has-activity" : ""}
                        />
                        <b>
                          {
                            ["日", "一", "二", "三", "四", "五", "六"][
                              date.getDay()
                            ]
                          }
                        </b>
                      </div>
                    );
                  })}
                </div>
                <p className="muted-copy">
                  {state.totals.runs
                    ? "显示最近七天的代码运行次数。"
                    : "最近七天还没有练习记录。"}
                </p>
              </section>
            </div>
            <StudyOverview study={state.study} onOpen={openLesson} />
            <section className="panel recent-records">
              <div className="section-heading compact">
                <h2>最近的练习</h2>
                <button
                  className="text-button"
                  onClick={() => openLesson(nextLesson.id)}
                >
                  继续学习 <ArrowRight size={15} />
                </button>
              </div>
              {!state.totals.runs ? (
                <div className="empty-state">
                  <div className="empty-illustration">
                    <BookOpen size={30} />
                  </div>
                  <h3>暂无练习记录</h3>
                  <p>登录后运行代码，结果会记录在这里。</p>
                  <button
                    className="button primary"
                    onClick={() => openLesson("c-1")}
                  >
                    开启第一课 <ArrowRight size={16} />
                  </button>
                </div>
              ) : (
                <RunHistory
                  key={user?.id}
                  userId={user?.id || ""}
                  revision={state.totals.runs}
                  onInspect={setAttemptDetail}
                />
              )}
            </section>
          </main>
        )}
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
      {searchOpen && (
        <div className="modal-overlay" onClick={() => setSearchOpen(false)}>
          <section
            className="search-modal"
            role="dialog"
            aria-modal="true"
            aria-label="搜索课程"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="search-modal-input">
              <Search size={21} />
              <input
                autoFocus
                value={query}
                placeholder="搜索课程、语言或知识点"
                onChange={(event) => setQuery(event.target.value)}
              />
              <button
                className="icon-button"
                aria-label="关闭搜索"
                onClick={() => setSearchOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="search-caption">
              {query ? `找到 ${searched.length} 节相关课程` : "课程与知识点"}
            </div>
            <div className="search-results">
              {searched.slice(0, 9).map((item) => (
                <button key={item.id} onClick={() => openLesson(item.id)}>
                  <LanguageMark language={item.language} small />
                  <div>
                    <b>{item.title}</b>
                    <small>
                      {langName(item.language)} · {item.concepts.join(" / ")}
                    </small>
                  </div>
                  <ArrowUpRight size={16} />
                </button>
              ))}
              {searched.length > 9 && (
                <button
                  className="search-show-all"
                  onClick={() => {
                    setFilter("all");
                    setChapter("all");
                    navigate("courses");
                    setSearchOpen(false);
                  }}
                >
                  查看全部 {searched.length} 节匹配课程
                  <ArrowRight size={15} />
                </button>
              )}
              {!searched.length && (
                <p className="empty-search">没有找到课程，换个关键词试试。</p>
              )}
            </div>
            <div className="search-footer">
              <kbd>Esc</kbd> 关闭 <span>搜索支持课程名称、语言和知识点</span>
            </div>
          </section>
        </div>
      )}
      {helpOpen && (
        <div className="modal-overlay" onClick={() => setHelpOpen(false)}>
          <section
            className="help-modal"
            role="dialog"
            aria-modal="true"
            aria-label="学习指南"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              onClick={() => setHelpOpen(false)}
              aria-label="关闭指南"
            >
              <X size={20} />
            </button>
            <span className="brand-mark" aria-hidden="true" />
            <div className="eyebrow">使用说明</div>
            <h2>如何使用平台</h2>
            <p>
              在我的学习选择学习目标并做一道起点预测，AI结合已有记录安排任务。你也可以从课程中心自主选择。
            </p>
            <div className="help-steps">
              <div>
                <span>01</span>
                <b>先听基础，再读代码</b>
                <p>
                  打开课程后，AI老师会先解释需要的常识。直接回答、说哪里没懂，或者先运行看看。
                </p>
              </div>
              <div>
                <span>02</span>
                <b>看见执行，跟着问题修改</b>
                <p>
                  运行会触发分析；提问时老师会参考你正在看的课程图或真实执行步骤。代码与动画可以暂停、拖动和点击观察。
                </p>
              </div>
              <div>
                <span>03</span>
                <b>换个例子，继续巩固</b>
                <p>
                  修改后重新运行，需要时在对话里做一道审校小题。验证后可继续提问，或让AI安排下一项。
                </p>
              </div>
            </div>
            <button
              className="button primary"
              onClick={() => {
                setHelpOpen(false);
                navigate("dashboard");
              }}
            >
              回到我的学习 <ArrowRight size={16} />
            </button>
          </section>
        </div>
      )}
      {attemptDetail && user && (
        <AttemptDetail
          key={`${user.id}:${attemptDetail}`}
          id={attemptDetail}
          onClose={() => setAttemptDetail(null)}
        />
      )}
      {authModal}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  suffix,
  detail,
  color,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  suffix: string;
  detail: string;
  color: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className={`stat-icon ${color}`}>{icon}</span>
      </div>
      <div className="stat-value">
        {value}
        <span>{suffix}</span>
      </div>
      <p>{detail}</p>
    </div>
  );
}

function CourseCard({
  language,
  completed,
  onOpen,
  actionLabel,
}: {
  language: Language;
  completed: string[];
  onOpen: () => void;
  actionLabel?: string;
}) {
  const meta = languages.find((item) => item.id === language)!;
  const total = lessons.filter((l) => l.language === language).length;
  const minutes = lessons
    .filter((l) => l.language === language)
    .reduce((sum, l) => sum + l.minutes, 0);
  const count = completed.filter((id) => id.startsWith(language + "-")).length;
  return (
    <article className={`course-card ${meta.color}`}>
      <div className="course-card-top">
        <LanguageMark language={language} />
        <span className="course-level">{meta.level}</span>
      </div>
      <span className="course-tagline">{meta.tag}</span>
      <h3>
        {meta.name}
        <span>基础课程</span>
      </h3>
      <p>{meta.description}</p>
      <div className="course-meta">
        <span>
          <BookOpen size={13} />
          {total} 节课程
        </span>
        <i />
        <span>
          <Clock3 size={13} />约 {minutes} 分钟
        </span>
      </div>
      <div className="course-card-bottom">
        <div>
          <span>{`${count} / ${total} 节练习通过`}</span>
          <div className="progress-track">
            <i style={{ width: `${(count / total) * 100}%` }} />
          </div>
        </div>
        <button
          aria-label={actionLabel || `开始${meta.name}学习`}
          onClick={onOpen}
        >
          <ArrowUpRight size={19} />
        </button>
      </div>
    </article>
  );
}
