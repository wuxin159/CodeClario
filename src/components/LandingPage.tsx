import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, ChevronDown, Expand, Menu, X } from "lucide-react";
import BrandIdentity from "./BrandIdentity";
import BubbleSortShowcase from "./BubbleSortShowcase";
import LanguageMark from "./LanguageMark";
import {MotionText,MotionArrow,RevealWords} from "./MotionText";
import {useReducedMotion} from "../hooks/useReducedMotion";
import { languages, lessons, type Language } from "../../shared/curriculum";

const screens = [
  { title: "学习安排", image: "task-hd-20261109", heading: "先找到，今天的下一步。", body: "从当前任务和真实学习记录出发，把目标拆成一小步。中断之后，也能接着继续。", focus: "当前学习任务", area: {left:"22%",top:"43%",width:"50%",height:"45%"} },
  { title: "动手实践", image: "editor-hd-20261109", heading: "把想法，写成自己的代码。", body: "编辑、运行、查看输出。老师的提问与代码放在同一处，带着问题亲手尝试。", focus: "代码编辑区", area: {left:"27%",top:"33%",width:"42%",height:"43%"} },
  { title: "执行观察", image: "observe-hd-20261109", heading: "停在变化发生的那一行。", body: "查看受支持程序的变量、函数调用、指针和对象状态，把代码与执行轨迹对应起来。", focus: "变量与对象的变化", area: {left:"56%",top:"47%",width:"42%",height:"35%"} },
  { title: "学习过程", image: "evidence-hd-20261109", heading: "留下的不只是一个答案。", body: "回看最初判断、运行与修改。独立作答、辅助通过和订正分别记录，下一步有据可循。", focus: "AI 诊断与复测", area: {left:"57%",top:"43%",width:"36%",height:"51%"} },
];
// 展示图保留用户截图的原始像素，用无损WebP传输；原图入口单独提供PNG。
const screenshotSize = { width: 3164, height: 1712 };
const faqs = [
  ["完全没有编程基础，也可以开始吗？", "可以。点击“零基础？从第一课开始”，从输出、变量与条件逐步学习。学过for循环和数组或列表，再进入冒泡排序综合实践；首页也可以先观察动画，不需要安装开发工具。"],
  ["图里的变化来自我的代码吗？", "首页排序动画是课程示例；课程中会区分示例与真实运行。受支持的C、C++、Python和Java程序可以查看执行状态；C/C++和Java使用同代码、同输入的隔离调试回放，并核对普通运行输出。超出采集范围时，普通运行结果仍然保留。"],
  ["AI会直接帮我把答案写完吗？", "老师结合你的判断和实际结果解释、追问或引导观察。你可以自己修改和验证，也可以主动请求帮助。看过参考或接受帮助后的作答会保留相应标记。"],
  ["需要注册才能试用吗？", "首页冒泡排序演示无需登录，可以切换语言和数据、暂停或单步观察。登录后进入课程，代码草稿、真实运行和作答记录会分别保存。"],
];
const clamp = (value: number) => Math.min(1, Math.max(0, value));

export default function LandingPage({ authenticated, accountLoading = false, startingLesson = false, leaving = false, onEnter, onStartLesson }: {
  authenticated: boolean; accountLoading?: boolean; startingLesson?: boolean; leaving?:boolean; onEnter: () => void; onStartLesson?: (lessonId: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [homeLanguage, setHomeLanguage] = useState<Language>("python");
  const [selected, setSelected] = useState(0);
  const [manualStory, setManualStory] = useState(false);
  const [faq, setFaq] = useState(0);
  const systemReduced = useReducedMotion();
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [fullSize, setFullSize] = useState(false);
  const page = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const unfold = useRef<HTMLElement>(null);
  const unfoldImage = useRef<HTMLButtonElement>(null);
  const story = useRef<HTMLElement>(null);
  const storyTabs = useRef<HTMLDivElement>(null);
  const nav = useRef<HTMLElement>(null);
  const navMarkerItem = useRef<HTMLElement | null>(null);
  const manualLock = useRef(false);
  const activeScreen = useRef(0);
  const motionOff = systemReduced;
  const screen = screens[selected];
  const preview = lightbox === null ? null : screens[lightbox];

  const markNav = (item: HTMLElement) => {
    const root = nav.current;
    if (!root) return;
    navMarkerItem.current = item;
    root.style.setProperty('--nav-marker-x', `${item.offsetLeft}px`);
    root.style.setProperty('--nav-marker-y', `${item.offsetTop + item.offsetHeight - 2}px`);
    root.style.setProperty('--nav-marker-width', `${item.offsetWidth}`);
    root.dataset.marker = 'visible';
  };
  const hideNavMarker = () => {
    navMarkerItem.current = null;
    if (nav.current) delete nav.current.dataset.marker;
  };
  useLayoutEffect(() => {
    const root = nav.current;
    if (!root) return;
    const observer = new ResizeObserver(() => { if (navMarkerItem.current) markNav(navMarkerItem.current); });
    observer.observe(root);
    return () => observer.disconnect();
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
    const wide = matchMedia("(min-width: 901px) and (min-height: 700px)");
    let visible = false;
    let frame = 0;
    // 仅在相关章节可见且滚动发生时请求一帧；没有永久运行的页面动画循环。
    const render = () => {
      frame = 0;
      const height = window.innerHeight;
      if (active.get(section)) {
        const bounds = section.getBoundingClientRect();
        const progress = clamp((height - bounds.top) / (height * 0.85));
        const angle = wide.matches ? 7 * (1 - progress) : 0;
        const scale = 0.93 + progress * 0.07;
        picture.style.transform = `perspective(1600px) rotateX(${angle}deg) scale(${scale})`;
      }
      if (active.get(journey) && wide.matches && !manualLock.current) {
        const position = journey.getBoundingClientRect();
        const travel = Math.max(1, position.height - height);
        const step = Math.min(screens.length - 1, Math.floor(clamp(-position.top / travel) * screens.length));
        // 滚动每帧只读位置；实际进入新章节时才更新截图和说明。
        if (step !== activeScreen.current) {
          activeScreen.current = step;
          setSelected(step);
        }
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

  useLayoutEffect(() => {
    const list = storyTabs.current;
    const tab = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!list || !tab) return;
    const measure = () => {
      list.style.setProperty("--story-tab-x", `${tab.offsetLeft}px`);
      list.style.setProperty("--story-tab-y", `${tab.offsetTop + tab.offsetHeight - 1}px`);
      list.style.setProperty("--story-tab-length", `${tab.offsetWidth}`);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    observer.observe(tab);
    return () => observer.disconnect();
  }, [selected]);

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
    activeScreen.current = index;
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

  return <div ref={page} className={"landing-page cinematic-landing" + (motionOff ? " motion-off" : "") + (leaving ? " workspace-leaving" : "")} id="home" inert={leaving}>
    <div className="cine-topbar">
      <header className="cine-nav cine-wide">
        <a className="cine-brand" href="#home" aria-label="代码灵 CodeClario 网站主页"><BrandIdentity /></a>
        <nav ref={nav} aria-label="网站导航" className={"cine-motion-nav"+(menu ? " is-open" : "")} onPointerLeave={()=>{if(!nav.current?.contains(document.activeElement))hideNavMarker();}} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node | null))hideNavMarker();}}>
          <span className="cine-nav-marker" aria-hidden="true"/>
          {[['#home/preview','学习方式'],['#home/courses','课程语言'],['#home/faq','常见问题']].map(([href,label])=><a key={href} href={href} onPointerEnter={event=>markNav(event.currentTarget)} onFocus={event=>markNav(event.currentTarget)} onClick={() => setMenu(false)}><MotionText text={label}/></a>)}
        </nav>
        <div className="cine-nav-actions">
          <button className="cine-enter" onClick={onEnter} disabled={accountLoading}><MotionText text={enterLabel}/><MotionArrow diagonal size={15}/></button>
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
          <h1 aria-label="看见执行 学懂代码"><span className="cine-title-line"><span><RevealWords words={['看见','执行']}/></span></span><span className="cine-title-line"><span><RevealWords words={['学懂','代码']} start={2}/></span></span></h1>
          <div className="cine-hero-support">
            <p className="cine-hero-description cine-hero-enter">从一段冒泡排序开始，看懂循环与数组怎样配合。<br/>跟着AI的引导，动手修改，再验证自己的理解。</p>
            <div className="cine-actions cine-hero-enter">
              <button className="cine-button cine-button-light" onClick={() => onStartLesson ? onStartLesson(lessons.find(l=>l.language===homeLanguage&&l.topic==="bubble-sort")!.id) : onEnter()} disabled={accountLoading || startingLesson}><MotionText text={startingLesson ? "正在进入课程…" : "从这一课开始"}/><MotionArrow/></button>
              <button className="cine-text-action" onClick={() => onStartLesson ? onStartLesson(`${homeLanguage}-1`) : onEnter()} disabled={accountLoading || startingLesson}><MotionText text="零基础？从第一课开始"/><MotionArrow diagonal size={17}/></button>
            </div>
            <p className="cine-course-note">适合已学过for循环与数组的你</p>
          </div>
        </div>
        </div>
        <div className="cine-hero-stage"><BubbleSortShowcase language={homeLanguage} onLanguageChange={setHomeLanguage} paused={motionOff}/></div>
      </section>

      <div className="cine-opening-bottom cine-wide">
        <a className="cine-scroll" href="#home/preview"><ArrowDown size={17}/><MotionText text="看看如何学习"/></a>
        <p>C / C++ / Python / Java<span>·</span>{lessons.length}节课程与实践</p>
      </div>
    </div>

    <div className="cine-main-content">
      <section ref={unfold} className="cine-unfold" id="home/preview" aria-labelledby="unfold-title">
        <div className="cine-section-head cine-wide">

          <div className="cine-head-row">
            <h2 id="unfold-title" data-reveal><RevealWords words={['从一行','代码，']}/><br/><RevealWords words={['看到','每次变化。']} start={2}/></h2>
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

      <section ref={story} className="cine-journey" id="home/journey" aria-labelledby="journey-title" style={{ "--story-step": (selected + 1) / screens.length } as CSSProperties}>
        <div className="cine-journey-stage cine-wide">
          <div className="cine-journey-heading"><h2 id="journey-title" data-reveal><RevealWords words={['从好奇，','到自己弄懂。']}/></h2></div>
          <div className="cine-journey-layout">
            <div className="cine-journey-copy">
              <div ref={storyTabs} className="cine-journey-tabs" role="tablist" aria-label="查看四个学习环节">
                <span className="cine-journey-indicator" aria-hidden="true"/>
                {screens.map((item,index) => <button key={item.image} id={"cine-tab-"+index} role="tab" tabIndex={selected===index?0:-1} aria-selected={selected===index} aria-controls="cine-journey-panel" onClick={()=>chooseScreen(index)} onKeyDown={event=>{
                  let next = index;
                  if(event.key==="ArrowRight"||event.key==="ArrowDown")next=(index+1)%screens.length;
                  else if(event.key==="ArrowLeft"||event.key==="ArrowUp")next=(index+screens.length-1)%screens.length;
                  else if(event.key==="Home")next=0;
                  else if(event.key==="End")next=screens.length-1;
                  else return;
                  event.preventDefault();chooseScreen(next);document.getElementById("cine-tab-"+next)?.focus();
                }}><small aria-hidden="true">0{index+1}</small><MotionText text={item.title}/></button>)}
              </div>
              <div className="cine-journey-text-stack">
                {screens.map((item,index)=><div key={item.image} className={"cine-journey-description"+(selected===index?" is-current":"")} aria-hidden={selected!==index}><h3>{item.heading}</h3><p>{item.body}</p></div>)}
              </div>
              <div className="cine-journey-controls"><button onClick={()=>openPreview(selected)}><Expand size={15}/><MotionText text="放大界面"/></button>{manualStory&&<button className="cine-follow" onClick={followScroll}><MotionText text="跟随滚动"/><ArrowDown size={14}/></button>}</div>
            </div>
            <div className="cine-journey-media" id="cine-journey-panel" role="tabpanel" aria-labelledby={"cine-tab-"+selected}>
              <button className="cine-journey-image" onClick={()=>openPreview(selected)} aria-label={"放大"+screen.title+"界面示例"}>
                {screens.map((item,index)=><span key={item.image} className={`cine-journey-shot ${index===selected?"is-current":index<selected?"is-past":"is-next"}`} aria-hidden={index!==selected}>
                  <img src={`/product/${item.image}.webp`} alt={index===selected?"代码灵"+item.title+"真实界面示例":""} loading="lazy" decoding="async" {...screenshotSize}/>
                  <span className="cine-journey-focus" style={item.area} aria-hidden="true"/>
                </span>)}
                <span className="cine-journey-expand"><Expand size={16}/></span>
              </button>
              <p className="cine-journey-caption"><span>观察重点：{screen.focus}</span><span>{selected+1} / {screens.length}</span></p>
              <div className="cine-journey-progress" aria-hidden="true"><span/></div>
            </div>
          </div>
          <div className="cine-thumbnails" aria-label="全部产品界面">
            {screens.map((item,index)=><button key={item.image} aria-label={"选择"+item.title+"界面"} aria-pressed={selected===index} onClick={()=>chooseScreen(index)}><img src={`/product/${item.image}-320.webp`} alt={item.title+"缩略图"} loading="lazy" decoding="async" width="320" height="173"/><span>{item.title}</span></button>)}
          </div>
        </div>
      </section>



      <section className="cine-courses cine-wide" id="home/courses" aria-labelledby="courses-title">
        <div className="cine-head-row"><div><h2 id="courses-title" data-reveal><RevealWords words={['从','第一行']}/><br/><RevealWords words={['走到','自己的程序']} start={2}/></h2></div><p data-reveal>{lessons.length}节课程与实践，沿着概念逐步展开。<br/>你可以跟着安排，也可以自主选课。</p></div>
        <div className="cine-language-list">{languages.map(language=><button key={language.id} onClick={()=>onStartLesson?onStartLesson(`${language.id}-1`):onEnter()} disabled={accountLoading || startingLesson} data-reveal aria-label={"学习"+language.name}>
          <span className="cine-language-symbol"><LanguageMark language={language.id}/></span>
          <span className="cine-language-copy"><b><MotionText text={language.name}/></b><span>{language.description}</span><small>{lessons.filter(lesson=>lesson.language===language.id).length}节课程与实践</small></span>
          <MotionArrow diagonal size={36}/>
        </button>)}</div>
      </section>

      <section className="cine-faq cine-wide" id="home/faq" aria-labelledby="faq-title">
        <h2 id="faq-title" data-reveal><RevealWords words={['你可能','还想知道']}/></h2>
        <div className="cine-faq-layout">
          <div className="cine-faq-list">{faqs.map(([question,answer],index)=><div key={question}><button id={"cine-question-"+index} aria-expanded={faq===index} aria-controls={"cine-answer-"+index} onClick={()=>setFaq(current=>current===index?-1:index)}><span className="cine-faq-dot"/><span>{question}</span><ChevronDown size={17}/></button><div id={"cine-answer-"+index} className={"cine-faq-response"+(faq===index?" is-open":"")} role="region" aria-labelledby={"cine-question-"+index} aria-hidden={faq!==index}><div className="cine-faq-response-inner"><p>{answer}</p></div></div></div>)}</div>
        </div>
      </section>

      <section className="cine-close" id="home/start" aria-labelledby="closing-title">
        <div className="cine-wide"><div><h2 id="closing-title" data-reveal><span className="cine-close-line">下一次“原来如此”，</span><span className="cine-close-line">从这里开始。</span></h2></div><button className="cine-button cine-button-light" onClick={onEnter} disabled={accountLoading}><MotionText text="开始学习"/><MotionArrow size={20}/></button></div>
      </section>
      <footer className="cine-footer cine-wide"><a className="cine-brand" href="#home" aria-label="代码灵 CodeClario 返回顶部"><BrandIdentity/></a><p>让代码看得见，让学习有方向。</p><span>C17 · C++17 · Python 3 · Java 21</span></footer>
    </div>
    </main>

    {preview&&<div className="cine-lightbox" role="presentation" onClick={()=>setLightbox(null)}><div role="dialog" aria-modal="true" aria-label={preview.title+"界面预览"} ref={dialog} onClick={event=>event.stopPropagation()}>
      <header><b>{preview.title} · 高清界面示例</b><div><button onClick={()=>setFullSize(!fullSize)}>{fullSize?"适应窗口":"原尺寸查看"}</button><a href={`/product/${preview.image}.png`} target="_blank" rel="noreferrer">打开PNG原图<ArrowUpRight size={14}/></a><button aria-label="关闭图片预览" onClick={()=>setLightbox(null)}><X size={22}/></button></div></header>
      <div className={"cine-lightbox-image"+(fullSize?" full-size":"")}><img src={`/product/${preview.image}.webp`} alt={"代码灵"+preview.title+"完整界面示例"} {...screenshotSize}/></div>
    </div></div>}
  </div>;
}
