import {languageName} from "../../shared/curriculum";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import type { Language } from "../../shared/curriculum";
import { BUBBLE_DATASETS, buildBubbleScene } from "../../shared/bubbleSort";
import { sceneFrame } from "../../shared/sceneMotion";
import { useScenePlayback } from "../hooks/useScenePlayback";
import BubbleSortDiagram, { SHOWCASE_COMPARE_HOLD } from "./BubbleSortDiagram";
import HomeLanguageSwitch from "./HomeLanguageSwitch";
import SelectControl from "./SelectControl";
import "../bubble-sort.css";

// 高亮只在语义步骤或换位阶段变化时移动；连续帧不重建代码行。
const BubbleSource = memo(function BubbleSource({ language, code, line, swap, open, reduced, onToggle }: {
  language: Language; code: string; line: number; swap: boolean; open: boolean; reduced: boolean; onToggle: () => void;
}) {
  const codeRef = useRef<HTMLPreElement>(null);
  useLayoutEffect(() => {
    const pre = codeRef.current;
    if (!pre) return;
    const update = () => {
      if (!pre.clientHeight) return;
      const first = pre.querySelector<HTMLElement>(`[data-line="${swap ? 6 : line}"]`);
      const last = pre.querySelector<HTMLElement>(`[data-line="${swap ? 8 : line}"]`);
      if (!first || !last) return;
      const top = first.offsetTop, bottom = last.offsetTop + last.offsetHeight;
      pre.style.setProperty("--bubble-cursor-y", `${top}px`);
      pre.style.setProperty("--bubble-cursor-size", `${bottom - top}`);
      if (top < pre.scrollTop || bottom > pre.scrollTop + pre.clientHeight)
        pre.scrollTo({ top: Math.max(0, top - pre.clientHeight / 3), behavior: reduced ? "instant" : "smooth" });
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(pre);
    return () => observer.disconnect();
  }, [line, swap, code, open, reduced]);
  return <div className={`bubble-source ${open ? "is-open" : ""}`}>
    <button className="bubble-code-toggle" aria-expanded={open} onClick={onToggle}>查看对应代码 · 第 {line} 行<ChevronRight size={14}/></button>
    <div className="bubble-source-title">{languageName(language)} · 排序核心</div>
    <pre ref={codeRef} tabIndex={0} aria-label="冒泡排序示例代码">
      <span className="bubble-code-cursor" aria-hidden="true"/>
      {code.split("\n").map((text, index) => <span key={index} data-line={index + 1} className={(swap ? index + 1 >= 6 && index + 1 <= 8 : index + 1 === line) ? "is-current" : ""} aria-current={index + 1 === line ? "step" : undefined}><i>{index + 1}</i><code>{text}</code></span>)}
    </pre>
  </div>;
});

const BubbleExplanation = memo(function BubbleExplanation({ phase, note, cue }: {phase: string; note: string; cue: number}) {
  return <div className="bubble-explanation" data-cue={cue} aria-live="off">
    <div className="bubble-phase">
      <strong>{phase}</strong>
      <div className="bubble-flow" aria-hidden="true">{["比较", "交换", "写回"].map((label, index) => <span key={label} className={cue === index + 1 ? "is-active" : ""}>{label}</span>)}</div>
    </div>
    <p key={note}>{note}</p>
  </div>;
});

export default function BubbleSortShowcase({ language, onLanguageChange, paused = false }: {
  language: Language; onLanguageChange: (language: Language) => void; paused?: boolean;
}) {
  const [dataset, setDataset] = useState(0), [onePass, setOnePass] = useState(false), [position, setPosition] = useState(0), [codeOpen, setCodeOpen] = useState(false);
  const scene = useMemo(() => buildBubbleScene(language, BUBBLE_DATASETS[dataset].values, onePass), [language, dataset, onePass]);
  const playback = useScenePlayback({ sceneId: scene.id, count: scene.steps.length, position, onPosition: setPosition, context: `home-bubble:${language}`, reduced: paused });
  const frame = sceneFrame(scene, playback.time), last = scene.steps.length - 1;
  const firstSwap = useMemo(() => scene.steps.findIndex(step => step.bubble?.phase === "swap"), [scene]);
  const root = useRef<HTMLDivElement>(null), latest = useRef(playback), previewHandled = useRef(false);
  latest.current = playback;
  useEffect(() => {
    const stop = () => latest.current.seek(Math.floor(latest.current.time));
    if (paused) { stop(); return; }
    const node = root.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    let timer: number | undefined;
    // 首次进入视野只演示第一对换位；手动操作或离开视野之后不会突然接管播放。
    const observer = new IntersectionObserver(([entry]) => {
      window.clearTimeout(timer);
      if (entry.isIntersecting && !previewHandled.current && firstSwap > 0) {
        timer = window.setTimeout(() => {
          if (previewHandled.current || document.hidden) return;
          previewHandled.current = true;
          latest.current.setSpeed(1.8);
          latest.current.playTo(firstSwap);
        }, 360);
      } else if (!entry.isIntersecting && latest.current.moving) stop();
    }, { threshold: .25 });
    observer.observe(node);
    return () => { window.clearTimeout(timer); observer.disconnect(); };
  }, [paused, firstSwap]);
  const touch = () => { previewHandled.current = true; };
  const change = (action: () => void) => { touch(); latest.current.seek(0); setPosition(0); action(); };
  const movingSwap = !paused && frame.progress > SHOWCASE_COMPARE_HOLD && frame.from.bubble?.phase === "compare" && frame.to.bubble?.phase === "swap";
  const written = frame.from.bubble?.phase === "swap";
  const cue = movingSwap ? 2 : written ? 3 : frame.from.bubble?.phase === "compare" || frame.from.bubble?.phase === "keep" ? 1 : 0;
  const toggleCode = useMemo(() => () => setCodeOpen(value => !value), []);
  const options = useMemo(() => <div className="bubble-showcase-options">
    <HomeLanguageSwitch language={language} onChange={value=>change(()=>onLanguageChange(value))}/>
    <label><span className="sr-only">选择排序示例</span><SelectControl label="选择排序示例" compact value={String(dataset)} onValueChange={value=>change(()=>setDataset(Number(value)))} options={BUBBLE_DATASETS.map((sample,index)=>({value:String(index),label:sample.label}))}/></label>
    <label><span className="sr-only">排序演示范围</span><SelectControl label="排序演示范围" compact value={onePass?'one':'complete'} onValueChange={value=>change(()=>setOnePass(value==='one'))} options={[{value:'complete',label:'完整排序'},{value:'one',label:'只做一轮'}]}/></label>
  </div>, [language, onLanguageChange, dataset, onePass]);
  return <div className="bubble-showcase" ref={root} id="home/demo" data-ui aria-label="循环与数组：冒泡排序课程演示">
    <div className="bubble-showcase-heading"><strong>冒泡排序<span>循环 × 数组</span></strong><span>可操作课程示例</span></div>
    {options}
    <div className="bubble-showcase-stage">
      <BubbleSortDiagram scene={scene} time={playback.time} reduced={paused} showcase onInspect={() => { touch(); playback.seek(frame.index); }}/>
      <BubbleSource language={language} code={scene.code} line={movingSwap ? 6 : frame.from.line} swap={movingSwap || written} open={codeOpen} reduced={paused} onToggle={toggleCode}/>
    </div>
    <BubbleExplanation phase={movingSwap ? "交换位置" : written ? "位置已更新" : frame.from.phase} note={movingSwap ? "先暂存左值，再把两个值写回各自的新位置。" : frame.from.note} cue={cue}/>
    <div className="bubble-transport">
      <button aria-label="重新开始冒泡演示" onClick={() => { touch(); playback.seek(0); if (!paused) playback.play(); }}><RotateCcw size={16}/></button>
      <button aria-label="冒泡演示上一步" disabled={playback.time <= 0} onClick={() => { touch(); playback.move(Math.max(0, Math.ceil(playback.time) - 1)); }}><ChevronLeft size={18}/></button>
      <button className="bubble-play" aria-label={playback.moving ? "暂停冒泡演示" : paused ? "冒泡演示继续一步" : "播放冒泡演示"} onClick={() => { touch(); playback.toggle(); }}>{playback.moving ? <Pause size={15}/> : <Play size={15}/>}<span>{playback.moving ? "暂停" : paused ? "继续一步" : "播放"}</span></button>
      <button aria-label="冒泡演示下一步" disabled={playback.time >= last} onClick={() => { touch(); playback.move(Math.min(last, frame.index + 1)); }}><ChevronRight size={18}/></button>
      <input aria-label="冒泡排序播放进度" aria-valuetext={`第${frame.index + 1}步，共${scene.steps.length}步；${frame.from.phase}`} type="range" min="0" max={last} step={paused ? 1 : .001} value={playback.time} onKeyDown={event => { if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return; event.preventDefault(); touch(); playback.seek(event.key === "ArrowRight" ? Math.min(last, Math.floor(playback.time) + 1) : Math.max(0, Math.ceil(playback.time) - 1)); }} onChange={event => { touch(); playback.seek(Number(event.target.value)); }}/>
      <span>{frame.index + 1}/{scene.steps.length}</span>
    </div>
  </div>;
}
