import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, ChevronDown, Expand, Menu, Pause, Play, X } from "lucide-react";
import BrandIdentity from "./BrandIdentity";
import BubbleSortShowcase from "./BubbleSortShowcase";
import { languages, lessons, type Language } from "../../shared/curriculum";

const screens = [
  { title: "学习安排", image: "task-hd-20261109", heading: "先找到，今天的下一步。", body: "从当前任务和真实学习记录出发，把目标拆成一小步。中断之后，也能接着继续。" },
  { title: "动手实践", image: "editor-hd-20261109", heading: "把想法，写成自己的代码。", body: "编辑、运行、查看输出。老师的提问与代码放在同一处，带着问题亲手尝试。" },
  { title: "执行观察", image: "observe-hd-20261109", heading: "停在变化发生的那一行。", body: "查看受支持程序的变量、函数调用、指针和对象状态，把代码与执行轨迹对应起来。" },
  { title: "学习过程", image: "evidence-hd-20261109", heading: "留下的不只是一个答案。", body: "回看最初判断、运行与修改。独立作答、辅助通过和订正分别记录，下一步有据可循。" },
];
// 展示图保留用户截图的原始像素，用无损WebP传输；原图入口单独提供PNG。
const screenshotSize = { width: 3164, height: 1712 };
const faqs = [
  ["完全没有编程基础，也可以开始吗？", "可以。点击“零基础？从第一课开始”，从输出、变量与条件逐步学习。学过for循环和数组或列表，再进入冒泡排序综合实践；首页也可以先观察动画，不需要安装开发工具。"],
  ["图里的变化来自我的代码吗？", "首页排序动画是课程示例；课程中会区分示例与真实运行。受支持的C、C++和Python程序可以查看执行状态；C/C++使用同代码、同输入的隔离调试回放，并核对普通运行输出。超出采集范围时，普通运行结果仍然保留。"],
  ["AI会直接帮我把答案写完吗？", "老师结合你的判断和实际结果解释、追问或引导观察。你可以自己修改和验证，也可以主动请求帮助。看过参考或接受帮助后的作答会保留相应标记。"],
  ["需要注册才能试用吗？", "首页冒泡排序演示无需登录，可以切换语言和数据、暂停或单步观察。登录后进入课程，代码草稿、真实运行和作答记录会分别保存。"],
];
const clamp = (value: number) => Math.min(1, Math.max(0, value));

export default function LandingPage({ authenticated, accountLoading = false, startingLesson = false, onEnter, onStartLesson }: {
  authenticated: boolean; accountLoading?: boolean; startingLesson?: boolean; onEnter: () => void; onStartLesson?: (lessonId: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [homeLanguage, setHomeLanguage] = useState<Language>("python");
  const [selected, setSelected] = useState(0);
  const [manualStory, setManualStory] = useState(false);
  const [faq, setFaq] = useState(0);
  const [paused, setPaused] = useState(false);
  const [systemReduced, setSystemReduced] = useState(() => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [fullSize, setFullSize] = useState(false);
  const page = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const unfold = useRef<HTMLElement>(null);
  const unfoldImage = useRef<HTMLButtonElement>(null);
  const story = useRef<HTMLElement>(null);
  const manualLock = useRef(false);
  const motionOff = paused || systemReduced;
  const screen = screens[selected];
  const preview = lightbox === null ? null : screens[lightbox];

  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!page.current || motionOff || typeof IntersectionObserver === "undefined") return;
    const root = page.current;
    root.classList.add("motion-ready");
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12 });
    root.querySelectorAll("[data-reveal]").forEach(element => observer.observe(element));
    return () => { observer.disconnect(); root.classList.remove("motion-ready"); };
  }, [motionOff]);

  useEffect(() => {
    const section = unfold.current;
    const picture = unfoldImage.current;
    const journey = story.current;
    if (!section || !picture || !journey || typeof IntersectionObserver === "undefined") return;
    if (motionOff) { picture.style.transform = "none"; return; }
    const wide = matchMedia("(min-width: 901px)");
    let visible = false;
    let frame = 0;
    // 仅在相关章节可见且滚动发生时请求一帧；没有永久运行的页面动画循环。
    const render = () => {
      frame = 0;
      const height = window.innerHeight;
      const bounds = section.getBoundingClientRect();
      const progress = clamp((height - bounds.top) / (height * 0.95));
      const angle = wide.matches ? 10 * (1 - progress) : 0;
      const scale = 0.88 + progress * 0.12;
      picture.style.transform = "perspective(1600px) rotateX(" + angle + "deg) scale(" + scale + ")";
      if (wide.matches && !manualLock.current) {
        const position = journey.getBoundingClientRect();
        const travel = Math.max(1, position.height - height);
        const step = Math.min(screens.length - 1, Math.floor(clamp(-position.top / travel) * screens.length));
        setSelected(current => current === step ? current : step);
      }
    };
    const request = () => { if (visible && !frame) frame = requestAnimationFrame(render); };
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => active.set(entry.target, entry.isIntersecting));
      visible = [...active.values()].some(Boolean);
      request();
    }, { rootMargin: "100px" });
    const active = new Map<Element, boolean>();
    observer.observe(section);
    observer.observe(journey);
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    wide.addEventListener("change", request);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
      wide.removeEventListener("change", request);
      picture.style.transform = "none";
    };
  }, [motionOff]);

  useEffect(() => {
    if (lightbox === null) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(null);
      if (event.key !== "Tab") return;
      const controls = [...dialog.current?.querySelectorAll<HTMLElement>("button,a") ?? []];
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [lightbox]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMenu(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  const chooseScreen = (index: number) => {
    // 手动选择优先于滚动编排，直到用户明确恢复，避免刚点开的图片立即被滚动监听改回。
    manualLock.current = true;
    setManualStory(true);
    setSelected(index);
  };
  const openPreview = (index: number) => { setFullSize(false); setLightbox(index); };
  const followScroll = () => {
    manualLock.current = false;
    setManualStory(false);
    window.dispatchEvent(new Event("scroll"));
  };
  const enterLabel = accountLoading ? "读取账户…" : authenticated ? "我的学习" : "登录";

  return <div ref={page} className={"landing-page cinematic-landing" + (motionOff ? " motion-off" : "")} id="home">
    <div className="cine-topbar">
      <header className="cine-nav cine-wide">
        <a className="cine-brand" href="#home" aria-label="代码灵 CodeClario 网站主页"><BrandIdentity /></a>
        <nav aria-label="网站导航" className={menu ? "is-open" : ""}>
          <a href="#home/preview" onClick={() => setMenu(false)}>学习方式</a>
          <a href="#home/demo" onClick={() => setMenu(false)}>排序演示</a>
          <a href="#home/courses" onClick={() => setMenu(false)}>课程</a>
          <a href="#home/faq" onClick={() => setMenu(false)}>常见问题</a>
        </nav>
        <div className="cine-nav-actions">
          <button className="cine-enter" onClick={onEnter} disabled={accountLoading}>{enterLabel}<ArrowUpRight size={15}/></button>
          <button className="cine-menu" aria-label={menu ? "关闭网站导航" : "打开网站导航"} aria-expanded={menu} onClick={() => setMenu(!menu)}>{menu ? <X size={21}/> : <Menu size={21}/>}</button>
        </div>
      </header>
    </div>
    <main>
    <div className="cine-opening">
      <section className="cine-hero" aria-label="代码灵产品介绍">
        <div className="cine-hero-content">
        <div className="cine-hero-copy">
          <p className="cine-learning-question">AI时代，如何高效学习编程，提升代码能力？</p>
          <h1 className="cine-hero-enter">看见执行<br/>学懂代码</h1>
          <div className="cine-hero-support">
            <p className="cine-hero-description cine-hero-enter">从一段冒泡排序开始，看懂循环与数组怎样配合。<br/>跟着AI的引导，动手修改，再验证自己的理解。</p>
            <div className="cine-actions cine-hero-enter">
              <button className="cine-button cine-button-light" onClick={() => onStartLesson ? onStartLesson(`${homeLanguage}-19`) : onEnter()} disabled={accountLoading || startingLesson}>{startingLesson ? "正在进入课程…" : "从这一课开始"}<ArrowRight size={18}/></button>
              <a className="cine-text-action" href="#home/demo">观察排序过程<ArrowUpRight size={17}/></a>
            </div>
            <p className="cine-course-note">适合已学过for循环与数组的你<br/><button onClick={() => onStartLesson ? onStartLesson(`${homeLanguage}-1`) : onEnter()} disabled={accountLoading || startingLesson}>零基础？从第一课开始<ArrowUpRight size={12}/></button></p>
          </div>
        </div>
        </div>
        <div className="cine-hero-stage"><BubbleSortShowcase language={homeLanguage} onLanguageChange={setHomeLanguage} paused={motionOff}/></div>
      </section>

      <div className="cine-opening-bottom cine-wide">
        <a className="cine-scroll" href="#home/preview"><ArrowDown size={17}/><span>看看如何学习</span></a>
        <p>C / C++ / Python<span>·</span>{lessons.length}节基础课程</p>
        <button className="cine-motion-control" aria-pressed={motionOff} disabled={systemReduced} onClick={() => setPaused(!paused)} title={systemReduced ? "系统已启用减少动态效果" : undefined}>
          {motionOff ? <Play size={14}/> : <Pause size={14}/>}
          {systemReduced ? "已减少动态" : paused ? "恢复页面动效" : "暂停页面动效"}
        </button>
      </div>
    </div>

    <div className="cine-main-content">
      <section ref={unfold} className="cine-unfold" id="home/preview" aria-labelledby="unfold-title">
        <div className="cine-section-head cine-wide">

          <div className="cine-head-row">
            <h2 id="unfold-title" data-reveal>从一行代码，<br/>看到每次变化。</h2>
            <p data-reveal>程序不是一张答案纸。<br/>它有正在变化的数值、关系和执行顺序。<br/>把过程展开，理解才有了落点。</p>
          </div>
        </div>
        <div className="cine-unfold-media cine-wide">
          <button ref={unfoldImage} className="cine-unfold-image" onClick={() => openPreview(2)} aria-label="放大执行观察界面示例">
            <img src={`/product/${screens[2].image}.webp`} alt="代码灵真实产品界面：代码与执行观察" loading="lazy" decoding="async" {...screenshotSize}/>
            <span><Expand size={16}/>查看完整界面</span>
          </button>
        </div>
        <div className="cine-image-note cine-wide"><span>代码与执行观察 · 真实产品界面示例</span><p>支持的程序可查看真实回放；课程示例与真实运行分别标注。</p></div>
      </section>

      <section ref={story} className="cine-journey" aria-labelledby="journey-title">
        <div className="cine-journey-stage cine-wide">
          <div className="cine-journey-heading"><h2 id="journey-title">从好奇，到自己弄懂。</h2></div>
          <div className="cine-journey-layout">
            <div className="cine-journey-copy">
              <div className="cine-journey-tabs" role="tablist" aria-label="查看四个学习环节">
                {screens.map((item,index) => <button key={item.image} id={"cine-tab-"+index} role="tab" tabIndex={selected===index?0:-1} aria-selected={selected===index} aria-controls="cine-journey-panel" onClick={()=>chooseScreen(index)} onKeyDown={event=>{
                  let next = index;
                  if(event.key==="ArrowRight"||event.key==="ArrowDown")next=(index+1)%screens.length;
                  else if(event.key==="ArrowLeft"||event.key==="ArrowUp")next=(index+screens.length-1)%screens.length;
                  else if(event.key==="Home")next=0;
                  else if(event.key==="End")next=screens.length-1;
                  else return;
                  event.preventDefault();chooseScreen(next);document.getElementById("cine-tab-"+next)?.focus();
                }}><span>{item.title}</span><ArrowRight size={16}/></button>)}
              </div>
              <div className="cine-journey-description" key={screen.image}><h3>{screen.heading}</h3><p>{screen.body}</p></div>
              <div className="cine-journey-controls"><button onClick={()=>openPreview(selected)}><Expand size={15}/>放大界面</button>{manualStory&&<button className="cine-follow" onClick={followScroll}>跟随滚动<ArrowDown size={14}/></button>}</div>
            </div>
            <div className="cine-journey-media" id="cine-journey-panel" role="tabpanel" aria-labelledby={"cine-tab-"+selected}>
              <button className="cine-journey-image" onClick={()=>openPreview(selected)} aria-label={"放大"+screen.title+"界面示例"}>
                {screens.map((item,index)=><img key={item.image} src={`/product/${item.image}.webp`} className={index===selected?"is-current":""} alt={index===selected?"代码灵"+item.title+"真实界面示例":""} aria-hidden={index!==selected} loading="lazy" decoding="async" {...screenshotSize}/>)}
                <span><Expand size={16}/></span>
              </button>
              <p className="cine-journey-caption">{screen.title} · 真实产品界面示例 <span>{selected+1} / {screens.length}</span></p>
            </div>
          </div>
          <div className="cine-thumbnails" aria-label="全部产品界面">
            {screens.map((item,index)=><button key={item.image} aria-label={"选择"+item.title+"界面"} aria-pressed={selected===index} onClick={()=>chooseScreen(index)}><img src={`/product/${item.image}-320.webp`} alt={item.title+"缩略图"} loading="lazy" decoding="async" width="320" height="173"/><span>{item.title}</span></button>)}
          </div>
        </div>
      </section>



      <section className="cine-courses cine-wide" id="home/courses" aria-labelledby="courses-title">
        <div className="cine-head-row"><div><h2 id="courses-title" data-reveal>从第一行，<br/>走到自己的程序。</h2></div><p data-reveal>{lessons.length}节基础课程，沿着概念逐步展开。<br/>你可以跟着安排，也可以自主选课。</p></div>
        <div className="cine-language-list">{languages.map(language=><button key={language.id} onClick={onEnter} disabled={accountLoading} data-reveal aria-label={"学习"+language.name}>
          <span className="cine-language-symbol">{language.id==="python"?"Py":language.id==="cpp"?"C++":"C"}</span>
          <span className="cine-language-copy"><b>{language.name}</b><span>{language.id==="c"?"从变量、循环到指针，理解数据怎样变化。":language.id==="cpp"?"从基础语法到容器和对象，读懂结构与状态。":"从第一行输出到函数和容器，把想法写成程序。"}</span><small>{lessons.filter(lesson=>lesson.language===language.id).length}节基础课程</small></span>
          <ArrowUpRight className="cine-language-arrow" size={36}/>
        </button>)}</div>
      </section>

      <section className="cine-faq cine-wide" id="home/faq" aria-labelledby="faq-title">
        <h2 id="faq-title" data-reveal>你可能还想知道。</h2>
        <div className="cine-faq-layout">
          <div className="cine-faq-list">{faqs.map(([question,answer],index)=><div key={question}><button id={"cine-question-"+index} aria-expanded={faq===index} aria-controls={"cine-answer-"+index} onClick={()=>setFaq(index)}><span className="cine-faq-dot"/>{question}<ChevronDown size={17}/></button><p id={"cine-answer-"+index} className="cine-faq-response" hidden={faq!==index}>{answer}</p></div>)}</div>
        </div>
      </section>

      <section className="cine-close">
        <div className="cine-wide"><div><h2 data-reveal>下一次“原来如此”，<br/>从这里开始。</h2></div><button className="cine-button cine-button-light" onClick={onEnter} disabled={accountLoading}>开始学习<ArrowRight size={20}/></button></div>
      </section>
      <footer className="cine-footer cine-wide"><a className="cine-brand" href="#home" aria-label="代码灵 CodeClario 返回顶部"><BrandIdentity/></a><p>让代码看得见，让学习有方向。</p><span>C17 · C++17 · Python 3</span></footer>
    </div>
    </main>

    {preview&&<div className="cine-lightbox" role="presentation" onClick={()=>setLightbox(null)}><div role="dialog" aria-modal="true" aria-label={preview.title+"界面预览"} ref={dialog} onClick={event=>event.stopPropagation()}>
      <header><b>{preview.title} · 高清界面示例</b><div><button onClick={()=>setFullSize(!fullSize)}>{fullSize?"适应窗口":"原尺寸查看"}</button><a href={`/product/${preview.image}.png`} target="_blank" rel="noreferrer">打开PNG原图<ArrowUpRight size={14}/></a><button aria-label="关闭图片预览" onClick={()=>setLightbox(null)}><X size={22}/></button></div></header>
      <div className={"cine-lightbox-image"+(fullSize?" full-size":"")}><img src={`/product/${preview.image}.webp`} alt={"代码灵"+preview.title+"完整界面示例"} {...screenshotSize}/></div>
    </div></div>}
  </div>;
}
