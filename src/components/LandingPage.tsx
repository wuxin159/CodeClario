import { useEffect, useRef, useState } from "react";
import BrandIdentity from "./BrandIdentity";
import HomeVisualization from "./HomeVisualization";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  Code2,
  Expand,
  History,
  LocateFixed,
  Menu,
  Pause,
  Play,
  RotateCcw,
  X,
} from "lucide-react";
import { languages, lessons } from "../../shared/curriculum";

const screens = [
  {
    title: "我的学习",
    image: "task-current.jpg",
    icon: BookOpen,
    heading: "从适合自己的任务开始",
    body: "写下目标，完成起点预测。AI结合已有记录，选择一项具体练习，并说明选择的依据。",
  },
  {
    title: "课程实践",
    image: "editor.jpg",
    icon: Code2,
    heading: "写代码，也看懂它怎样运行",
    body: "AI在左侧主动讲解、提问和分析。代码与执行观察保持在一起，随时运行，核对理解。",
  },
  {
    title: "课程可视化",
    image: "observe.jpg",
    icon: LocateFixed,
    heading: "看见数据怎样流动",
    body: "循环边界、切片选区、指针访问和实例状态，都有对应的课程图形。代码与动画联动，可暂停、拖动和点击查看。",
  },
  {
    title: "学习记录",
    image: "evidence-current.jpg",
    icon: History,
    heading: "每一次修改，都能回头看",
    body: "保存预测、运行、修改与复测。独立答对和参考解析后的订正分开记录，继续安排下一步。",
  },
];
const faqs = [
  [
    "没有编程基础，可以从这里开始吗？",
    "可以。先选C、C++或Python，说明自己的目标，再做一道不计成绩的起点预测。AI会从现有课程中选择合适的任务，你也可以自主选课。",
  ],
  [
    "不在聊天框提问，AI也会帮助我吗？",
    "会。打开课程时，AI先介绍本节基础，再围绕当前代码提问；运行、修改和完成检验后也会主动分析。可以直接运行，不必先填预测表，遇到疑问随时在同一个对话框里追问。",
  ],
  [
    "可视化是自己代码的真实执行吗？",
    "受支持的C、C++和Python代码可以查看实际变量、调用和对象关系。课程示例另行标注；C/C++回放来自同代码同输入的隔离调试运行，并核对输出。超出采集范围时保留普通运行，不能把固定示例当成自己的执行。",
  ],
  [
    "下次打开，能接着上次的练习吗？",
    "可以。登录后，当前任务、代码草稿、标准输入、预测、运行和作答保存在自己的账户中。再次登录后可以继续，也可以查看之前的练习过程。",
  ],
];
export default function LandingPage({
  authenticated,
  onEnter,
}: {
  authenticated: boolean;
  onEnter: () => void;
}) {
  const [menu, setMenu] = useState(false),
    [selected, setSelected] = useState(0),
    [lightbox, setLightbox] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    dialog = useRef<HTMLDivElement>(null);
  const screen = screens[selected],
    action = authenticated ? "进入学习空间" : "开始学习";

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-seen");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.1 },
    );
    root.current
      ?.querySelectorAll(".home-reveal")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    if (lightbox) document.body.style.overflow = "hidden";
    if (lightbox)
      dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        setLightbox(false);
      }
      if (lightbox && e.key === "Tab") {
        const controls = [
          ...(dialog.current?.querySelectorAll<HTMLElement>("button,a") ?? []),
        ];
        if (e.shiftKey && document.activeElement === controls[0]) {
          e.preventDefault();
          controls.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === controls.at(-1)) {
          e.preventDefault();
          controls[0]?.focus();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (lightbox) {
        document.body.style.overflow = previousOverflow;
        previous?.focus();
      }
    };
  }, [lightbox]);

  return (
    <div className="landing-page handbook-home" id="home" ref={root}>
      <header className="home-nav">
        <a
          className="home-brand"
          href="#home"
          aria-label="代码灵 CodeClario 网站主页"
        >
          <BrandIdentity />
        </a>
        <nav aria-label="网站导航" className={menu ? "is-open" : ""}>
          <a href="#home/preview" onClick={() => setMenu(false)}>
            平台预览
          </a>
          <a href="#home/workflow" onClick={() => setMenu(false)}>
            学习方式
          </a>
          <a href="#home/courses" onClick={() => setMenu(false)}>
            课程范围
          </a>
          <a href="#home/faq" onClick={() => setMenu(false)}>
            常见问题
          </a>
        </nav>
        <div className="home-nav-actions">
          <button className="home-signin" onClick={onEnter}>
            {authenticated ? "学习空间" : "登录"}
            <ArrowUpRight size={16} />
          </button>
          <button
            className="home-menu"
            aria-label={menu ? "关闭网站导航" : "打开网站导航"}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main>
        <section className="home-hero home-wrap" aria-label="产品介绍">
          <div className="home-hero-copy">
            <h1>
              <span>让代码看得见，</span>
              <span>让学习有方向。</span>
            </h1>
            <p>
              AI先解释基础，再带你读代码、看执行。运行后主动分析，用新的小例子检验理解。
            </p>
            <div className="home-hero-actions">
              <button className="home-button" onClick={onEnter}>
                {action}
                <ArrowRight size={18} />
              </button>
              <a className="home-text-link" href="#home/preview">
                看看怎样学习
                <ArrowRight size={16} />
              </a>
            </div>
            <div className="home-hero-facts">
              <span>
                <Check size={15} /> C · C++ · Python
              </span>
              <span>
                <Check size={15} /> {lessons.length}节基础课程
              </span>
              <span>
                <Check size={15} /> 学习进度随账户保存
              </span>
            </div>
          </div>
          <HomeVisualization />
        </section>
        <section
          className="home-product home-wrap home-reveal"
          id="home/preview"
        >
          <div className="home-section-heading">
            <div>
              <h2>学习的每一步，都有着落</h2>
              <p>从选任务到回看过程，在同一个学习空间中完成。</p>
            </div>
            <button className="home-text-link" onClick={onEnter}>
              进入学习空间
              <ArrowRight size={16} />
            </button>
          </div>
          <div
            className="product-tabs"
            role="tablist"
            aria-label="平台页面预览"
            onKeyDown={(event) => {
              if (
                !["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? screens.length - 1
                    : (selected +
                        (event.key === "ArrowRight" ? 1 : -1) +
                        screens.length) %
                      screens.length;
              setSelected(next);
              document.getElementById(`preview-tab-${next}`)?.focus();
            }}
          >
            {screens.map((item, i) => (
              <button
                role="tab"
                id={`preview-tab-${i}`}
                aria-selected={selected === i}
                tabIndex={selected === i ? 0 : -1}
                aria-controls="product-preview-panel"
                key={item.image}
                onClick={() => setSelected(i)}
              >
                <item.icon size={18} />
                {item.title}
              </button>
            ))}
          </div>
          <div className="product-description">
            <h3>{screen.heading}</h3>
            <p>{screen.body}</p>
          </div>
          <figure
            className="product-frame"
            id="product-preview-panel"
            role="tabpanel"
            aria-labelledby={`preview-tab-${selected}`}
          >
            <div className="product-frame-bar">
              <span>
                <span className="home-small-mark" />
                {screen.title} · CodeClario
              </span>
              <button onClick={() => setLightbox(true)}>
                <Expand size={15} />
                放大查看
              </button>
            </div>
            <button
              className="product-image-button"
              aria-label={`放大${screen.title}完整截图`}
              onClick={() => setLightbox(true)}
            >
              <img
                src={`/product/${screen.image}`}
                alt={`代码灵${screen.title}完整界面截图`}
                width="1440"
                height="900"
                key={screen.image}
              />
            </button>
            <figcaption>实际产品界面 · 图片完整展示，可点击放大</figcaption>
          </figure>
          <div className="product-thumbnails">
            {screens.map((item, i) => (
              <button
                className={selected === i ? "selected" : ""}
                onClick={() => setSelected(i)}
                aria-label={`预览${item.title}`}
                key={item.image}
              >
                <img
                  src={`/product/${item.image}`}
                  alt={`${item.title}完整缩略图`}
                  width="1440"
                  height="900"
                  loading="lazy"
                />
                <span>
                  {item.title}
                  <ArrowUpRight size={14} />
                </span>
              </button>
            ))}
          </div>
        </section>
        <section className="home-teaching" id="home/workflow">
          <div className="home-wrap teaching-layout">
            <div className="teaching-intro home-reveal">
              <h2>
                AI的工作，
                <br />
                不止是回答问题
              </h2>
              <p>
                它参与任务选择，也在你预测、运行和修改时主动分析。具体的引导，出现在正在解决的问题旁边。
              </p>
              <div className="teaching-example">
                <LocateFixed size={22} />
                <blockquote>
                  “看看这次循环实际处理了哪些数字，和你原来的预期一样吗？”
                </blockquote>
                <span>引导方式示例</span>
              </div>
            </div>
            <div className="teaching-steps">
              {[
                [
                  "从目标选任务",
                  "结合学习目标、起点作答和历史记录，选择课程任务，说明为什么现在练这一项。",
                ],
                [
                  "从运行找问题",
                  "把预测与真实结果对照，引用本次代码和执行记录，引导你观察关键位置。",
                ],
                [
                  "由你修改，再独立检验",
                  "代码由你来改。编码通过后，使用审校新题检验理解，再安排复习或下一项任务。",
                ],
              ].map(([title, body], i) => (
                <article className="home-reveal" key={title}>
                  <span className="teaching-step-mark">
                    {i === 0 ? (
                      <BookOpen />
                    ) : i === 1 ? (
                      <LocateFixed />
                    ) : (
                      <Check />
                    )}
                  </span>
                  <div>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section
          className="home-courses home-wrap home-reveal"
          id="home/courses"
        >
          <div className="home-section-heading">
            <div>
              <h2>选一门语言，从基础出发</h2>
              <p>
                三种语言各18节课程。讲解、概念演示、理解检查与编码练习相互配合。
              </p>
            </div>
          </div>
          <div className="home-language-list">
            {languages.map((l) => (
              <article key={l.id}>
                <span className="language-name">
                  {l.id === "c" ? "C" : l.id === "cpp" ? "C++" : "Py"}
                </span>
                <div>
                  <h3>{l.name}</h3>
                  <p>{l.description}</p>
                  <span>
                    {
                      lessons.filter((lesson) => lesson.language === l.id)
                        .length
                    }
                    节基础课程
                  </span>
                </div>
                <button aria-label={`登录学习${l.name}`} onClick={onEnter}>
                  <ArrowRight size={20} />
                </button>
              </article>
            ))}
          </div>
        </section>
        <section className="home-faq home-wrap home-reveal" id="home/faq">
          <div>
            <h2>
              开始前，
              <br />
              你可能想知道
            </h2>
            <p>关于课程、AI和学习记录。</p>
          </div>
          <div>
            {faqs.map(([q, a], i) => (
              <details key={q} open={i === 0 ? true : undefined}>
                <summary>
                  {q}
                  <ChevronDown size={18} />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="home-wrap">
          <div className="home-closing home-reveal">
            <div>
              <h2>从一段代码，开始弄懂</h2>
              <p>把预期写下来，让每次运行和修改都有依据。</p>
            </div>
            <button className="home-button" onClick={onEnter}>
              {action}
              <ArrowRight size={18} />
            </button>
          </div>
        </section>
      </main>
      <footer className="home-footer home-wrap">
        <a
          className="home-brand"
          href="#home"
          aria-label="代码灵 CodeClario 返回顶部"
        >
          <BrandIdentity />
        </a>
        <p>AI驱动的可视化编程学习平台</p>
        <nav aria-label="页脚导航">
          <a href="#home/courses">课程范围</a>
          <a href="#home/faq">常见问题</a>
          <button onClick={onEnter}>
            {authenticated ? "我的学习" : "登录学习"}
          </button>
        </nav>
        <span>C17 · C++17 · Python 3</span>
      </footer>
      {lightbox && (
        <div
          className="product-lightbox"
          data-ui
          onClick={() => setLightbox(false)}
        >
          <div
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-label={`${screen.title}完整截图`}
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <b>{screen.title} · 完整界面</b>
              <a
                href={`/product/${screen.image}`}
                target="_blank"
                rel="noreferrer"
              >
                打开原图
                <ArrowUpRight size={15} />
              </a>
              <button
                aria-label="关闭截图预览"
                onClick={() => setLightbox(false)}
              >
                <X size={22} />
              </button>
            </header>
            <img
              src={`/product/${screen.image}`}
              alt={`${screen.title}完整原始截图`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
