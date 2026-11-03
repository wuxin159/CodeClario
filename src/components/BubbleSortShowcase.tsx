import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import type { Language } from "../../shared/curriculum";
import { BUBBLE_DATASETS, buildBubbleScene } from "../../shared/bubbleSort";
import { sceneFrame } from "../../shared/sceneMotion";
import { useScenePlayback } from "../hooks/useScenePlayback";
import BubbleSortDiagram from "./BubbleSortDiagram";
import "../bubble-sort.css";

export default function BubbleSortShowcase({ language, onLanguageChange, paused = false }: {
  language: Language; onLanguageChange: (language: Language) => void; paused?: boolean;
}) {
  const [dataset, setDataset] = useState(0), [onePass, setOnePass] = useState(false), [position, setPosition] = useState(0), [codeOpen, setCodeOpen] = useState(false);
  const [reduced, setReduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const scene = useMemo(() => buildBubbleScene(language, BUBBLE_DATASETS[dataset].values, onePass), [language, dataset, onePass]);
  const motionReduced = reduced || paused;
  const playback = useScenePlayback({ sceneId: scene.id, count: scene.steps.length, position, onPosition: setPosition, context: `home-bubble:${language}`, reduced: motionReduced });
  const frame = sceneFrame(scene, playback.time), last = scene.steps.length - 1;
  const root = useRef<HTMLDivElement>(null), codeRef = useRef<HTMLPreElement>(null), latest = useRef(playback), startOnce = useRef(false);
  latest.current = playback;
  useEffect(() => {
    const pre = codeRef.current;
    const row = pre?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!pre || !row || !pre.clientHeight) return;
    if (row.offsetTop < pre.scrollTop || row.offsetTop + row.offsetHeight > pre.scrollTop + pre.clientHeight)
      pre.scrollTo({ top: Math.max(0, row.offsetTop - pre.clientHeight / 2), behavior: motionReduced ? "instant" : "smooth" });
  }, [frame.from.line, language, codeOpen, motionReduced]);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const stop = () => latest.current.seek(Math.floor(latest.current.time));
    if (paused || reduced) { stop(); return; }
    const node = root.current;
    if (!node) return;
    // 进入首屏时仅自动演示一次；离屏停下，回到页面后交还用户控制，不反复抢走阅读位置。
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !startOnce.current) { startOnce.current = true; latest.current.setSpeed(2); latest.current.play(); }
      else if (!entry.isIntersecting && latest.current.moving) stop();
    }, { threshold: .25 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [paused, reduced]);
  const change = (action: () => void) => { latest.current.seek(0); setPosition(0); action(); };
  const movingSwap = frame.progress > 0 && frame.to.bubble?.phase === "swap";
  const swap = movingSwap || frame.from.bubble?.phase === "swap";
  return <div className="bubble-showcase" ref={root} id="home/demo" data-ui aria-label="循环与数组：冒泡排序课程演示">
    <div className="bubble-showcase-heading"><strong>冒泡排序<span>循环 × 数组</span></strong><span>可操作课程示例</span></div>
    <div className="bubble-showcase-options">
      <div className="bubble-languages" role="group" aria-label="排序演示语言">{(["c", "cpp", "python"] as const).map(value => <button key={value} aria-pressed={language === value} onClick={() => change(() => onLanguageChange(value))}>{value === "c" ? "C" : value === "cpp" ? "C++" : "Python"}</button>)}</div>
      <label><span className="sr-only">选择排序示例</span><select aria-label="选择排序示例" value={dataset} onChange={event => change(() => setDataset(Number(event.target.value)))}>{BUBBLE_DATASETS.map((sample, index) => <option key={sample.label} value={index}>{sample.label}</option>)}</select></label>
      <label><span className="sr-only">排序演示范围</span><select aria-label="排序演示范围" value={onePass ? "one" : "complete"} onChange={event => change(() => setOnePass(event.target.value === "one"))}><option value="complete">完整排序</option><option value="one">只做一轮</option></select></label>
    </div>
    <div className="bubble-showcase-stage">
      <BubbleSortDiagram scene={scene} time={playback.time} reduced={motionReduced} onInspect={() => playback.seek(frame.index)}/>
      <div className={`bubble-source ${codeOpen ? "is-open" : ""}`}>
        <button className="bubble-code-toggle" aria-expanded={codeOpen} onClick={() => setCodeOpen(value => !value)}>查看对应代码 · 第 {frame.from.line} 行<ChevronRight size={14}/></button>
        <div className="bubble-source-title">{language === "python" ? "Python" : language === "cpp" ? "C++" : "C"} · 排序核心</div>
        <pre ref={codeRef} tabIndex={0} aria-label="冒泡排序示例代码">{scene.code.split("\n").map((line, index) => <span key={index} className={(swap ? index + 1 >= 6 && index + 1 <= 8 : index + 1 === frame.from.line) ? "is-current" : ""} aria-current={index + 1 === frame.from.line ? "step" : undefined}><i>{index + 1}</i><code>{line}</code></span>)}</pre>
      </div>
    </div>
    <div className="bubble-explanation" aria-live="off"><strong>{movingSwap ? "交换位置" : frame.from.phase}</strong><p>{movingSwap ? "先暂存左值，再写回两边。这里把三条赋值合并展示为一次交换。" : frame.from.note}</p></div>
    <div className="bubble-transport">
      <button aria-label="重新开始冒泡演示" onClick={() => { playback.seek(0); if (!motionReduced) playback.play(); }}><RotateCcw size={16}/></button>
      <button aria-label="冒泡演示上一步" disabled={playback.time <= 0} onClick={() => playback.move(Math.max(0, Math.ceil(playback.time) - 1))}><ChevronLeft size={18}/></button>
      <button className="bubble-play" aria-label={playback.moving ? "暂停冒泡演示" : reduced || paused ? "冒泡演示继续一步" : "播放冒泡演示"} onClick={() => paused ? playback.seek(Math.min(last, frame.index + 1)) : playback.toggle()}>{playback.moving ? <Pause size={15}/> : <Play size={15}/>}<span>{playback.moving ? "暂停" : reduced || paused ? "继续一步" : "播放"}</span></button>
      <button aria-label="冒泡演示下一步" disabled={playback.time >= last} onClick={() => playback.move(Math.min(last, frame.index + 1))}><ChevronRight size={18}/></button>
      <input aria-label="冒泡排序播放进度" aria-valuetext={`第${frame.index + 1}步，共${scene.steps.length}步；${frame.from.phase}`} type="range" min="0" max={last} step={motionReduced ? 1 : .001} value={playback.time} onKeyDown={event => { if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return; event.preventDefault(); playback.seek(event.key === "ArrowRight" ? Math.min(last, Math.floor(playback.time) + 1) : Math.max(0, Math.ceil(playback.time) - 1)); }} onChange={event => playback.seek(Number(event.target.value))}/>
      <span>{frame.index + 1}/{scene.steps.length}</span>
    </div>
  </div>;
}
