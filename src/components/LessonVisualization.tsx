import {languageName} from "../../shared/curriculum";
import {extensionFor} from "../../shared/courseExtensions";
import type {AuthoredCourse} from "../../shared/authoredCourse";
import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import type { Lesson } from "../../shared/curriculum";
import type { Scene, SceneOptions } from "../../shared/scenes";
import { sceneFrame } from "../../shared/sceneMotion";
import { visualLesson } from "../../shared/visualLessons";
import { useScenePlayback } from "../hooks/useScenePlayback";
import {useReducedMotion} from "../hooks/useReducedMotion";
import {useBriefMotion} from "../hooks/useBriefMotion";
import SelectControl from "./SelectControl";
import TeachingCanvas from "./TeachingCanvas";
import MotionSource from "./MotionSource";
import ConceptStage, { hasConceptStage } from "./ConceptStage";
import BubbleSwapDetail from "./BubbleSwapDetail";
import CourseConceptScene from "./course-scenes/CourseConceptScene";
import ConceptExploreDialog from "./ConceptExploreDialog";
import { conceptWalk, contrastForLesson } from "../../shared/conceptExplorations";

export default function LessonVisualization({
  lesson,
  scene,
  options,
  onOptions,
  position,
  onPosition,
  playbackContext,
  onAsk,
  children,
}: {
  lesson: Lesson;
  scene: Scene;
  options: SceneOptions;
  onOptions: (o: SceneOptions) => void;
  position: number;
  onPosition: (n: number) => void;
  playbackContext: string;
  onAsk?: (question: string, stepIndex: number) => void;
  children?: ReactNode;
}) {
  const reduced = useReducedMotion();
  const playback = useScenePlayback({
    sceneId: scene.id,
    count: scene.steps.length,
    position,
    onPosition,
    context: playbackContext,
    reduced,
  });
  const stage = useRef<HTMLDivElement>(null), latestPlayback = useRef(playback);
  latestPlayback.current = playback;
  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    let live = true;
    // 切到手机教学窗格或离开图形区域时保留完整步骤，避免没看到的交换仍在后台推进。
    const observer = new IntersectionObserver(([entry]) => {
      const current = latestPlayback.current;
      if (live && !entry.isIntersecting && current.moving) current.seek(Math.floor(current.time));
    }, { threshold: .05 });
    observer.observe(node);
    return () => { live = false; observer.disconnect(); };
  }, [scene.id]);
  const frame = sceneFrame(scene, playback.time);
  // 只在完整教学步骤改变时强调，不随连续时间轴的每一帧重复触发。
  const stepMotion=useBriefMotion(`${scene.id}:${frame.index}`,540);
  const outputMotion=useBriefMotion(`${scene.id}:${frame.from.output}`,540);
  const visual = visualLesson(lesson);
  const [sourceShare, setSourceShare] = useState(scene.code.split("\n").length <= 6 ? 33 : 42);
  const [showSource, setShowSource] = useState(true);
  const [exploration, setExploration] = useState<"walk"|"contrast">();
  const ask = onAsk ? (question: string) => { playback.seek(frame.index); onAsk(question, frame.index); } : undefined;
  const [parameterText, setParameterText] = useState(String(options.value));
  useEffect(() => setParameterText(String(options.value)), [options.value]);
  const commitParameter = (text: string) => {
    if (!/^-?\d+$/.test(text)) {
      setParameterText(String(options.value));
      return;
    }
    const value = Math.max(
      lesson.index === 3 ? 1 : -9,
      Math.min(
        lesson.index === 3 ? 8 : lesson.index === 4 ? 9 : 99,
        Number(text),
      ),
    );
    setParameterText(String(value));
    if (value !== options.value) onOptions({ ...options, value });
  };
  const last = scene.steps.length - 1;
  const destination = frame.progress > 0.001 ? frame.index + 2 : undefined;
  const stepLabel = `${frame.index + 1}${destination ? ` → ${destination}` : ""} / ${scene.steps.length}`;
  const revealStage = () => {
    const node=stage.current,reader=node?.closest<HTMLElement>(".lesson-reading-pane");
    if(!node||!reader||!reader.clientHeight)return;
    const a=node.getBoundingClientRect(),b=reader.getBoundingClientRect();
    // 底栏始终可见；从补充说明开始播放时先带回主图，避免不可见的播放继续推进。
    if(a.bottom<=b.top||a.top>=b.bottom)reader.scrollTop+=a.top-b.top;
  };
  return (
    <section
      className={`lesson-visualization motion-visualization ${reduced ? "reduced" : ""}`}
      data-visual-kind={visual.kind}
      data-step-motion={stepMotion}
      data-output-motion={outputMotion}
      aria-label="本课可视化"
      tabIndex={0}
      onKeyDown={(e) => {
        if (
          (e.target as HTMLElement).closest("input,select,textarea,button,pre,summary,dialog,[role=dialog],[role=separator]")
        )
          return;
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          playback.move(
            Math.max(
              0,
              Math.min(last, frame.index + (e.key === "ArrowRight" ? 1 : -1)),
            ),
          );
        }
      }}
    >
      <div className="lesson-reading-pane">
      <div className="visual-heading">
        <div>
          <h2 title={scene.title}>{visual.question}</h2>
        </div>
        <div className="classroom-visual-actions"><span className="visual-step-number">{stepLabel}</span><button aria-pressed={showSource} onClick={()=>setShowSource(v=>!v)}>{showSource?"收起代码":"显示代码"}</button>{ask && <button onClick={() => ask(`请结合当前课程示例第${frame.index + 1}步，讲讲「${frame.from.phase}」为什么这样变化。`)}>问问这一步</button>}</div>
      </div>
      {lesson.topic === "bubble-sort" && <div className="bubble-lesson-variants" role="group" aria-label="冒泡排序示例版本"><button aria-pressed={!options.fixed} onClick={() => onOptions({ ...options, fixed: false })}>先看一轮</button><button aria-pressed={options.fixed} onClick={() => onOptions({ ...options, fixed: true })}>完整排序</button></div>}
      {(extensionFor(lesson.id) as AuthoredCourse|undefined)?.alternate&&<div className="bubble-lesson-variants" role="group" aria-label="本课对照路径"><button aria-pressed={!options.fixed} onClick={()=>onOptions({...options,fixed:false})}>{(extensionFor(lesson.id) as AuthoredCourse).demoLabel??"常规路径"}</button><button aria-pressed={options.fixed} onClick={()=>onOptions({...options,fixed:true})}>{(extensionFor(lesson.id) as AuthoredCourse).alternate!.label}</button></div>}
      {lesson.language !== "java" && lesson.index < 6 && (
        <div className="scene-parameters">
          {lesson.index >= 2 && (
            <div className="scene-variants" aria-label="示例版本">
              <button
                className={!options.fixed ? "selected" : ""}
                onClick={() => onOptions({ ...options, fixed: false })}
              >
                初始示例
              </button>
              <button
                className={options.fixed ? "selected" : ""}
                onClick={() => onOptions({ ...options, fixed: true })}
              >
                修正示例
              </button>
            </div>
          )}
          {lesson.index === 0 ? (
            <label>
              输出文字
              <input
                aria-label="示例输出文字"
                maxLength={28}
                value={options.text}
                onChange={(e) =>
                  onOptions({ ...options, text: e.target.value })
                }
              />
            </label>
          ) : (
            <label>
              {
                ["", "赋值为", "输入 age", "范围上界", "第三个元素", "参数 n"][
                  lesson.index
                ]
              }
              <input
                type="text"
                inputMode="numeric"
                className="scene-number-input"
                maxLength={4}
                aria-label="示例参数"
                value={parameterText}
                onChange={(e) => {
                  const text = e.target.value;
                  if (!/^-?\d*$/.test(text)) return;
                  playback.seek(frame.index);
                  setParameterText(text);
                  if (/^-?\d+$/.test(text)) commitParameter(text);
                }}
                onBlur={() => commitParameter(parameterText)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitParameter(parameterText);
                }}
              />
            </label>
          )}
        </div>
      )}
      <div ref={stage} className={`motion-stage ${showSource?"":"source-collapsed"}`} style={{"--source-width":`${sourceShare}%`} as CSSProperties} role="group" aria-label="示例代码与动画">
        <div className="classroom-source-wrap" hidden={!showSource}>
        <MotionSource
          code={scene.code}
          fromLine={frame.from.line}
          stepKey={frame.index}
          toLine={frame.to.line}
          progress={reduced ? 0 : frame.progress}
          reduced={reduced}
          language={
            languageName(lesson.language)
          }
        />
        </div>
        {showSource&&<div className="lesson-splitter" role="separator" tabIndex={0} aria-label="调整代码与图形宽度" aria-orientation="vertical" aria-valuemin={25} aria-valuemax={55} aria-valuenow={sourceShare}
          onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();}}
          onPointerMove={e=>{if(!e.currentTarget.hasPointerCapture(e.pointerId)||!stage.current)return;const rect=stage.current.getBoundingClientRect();setSourceShare(Math.round(Math.max(25,Math.min(55,(e.clientX-rect.left)/rect.width*100))));}}
          onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
          onKeyDown={e=>{if(e.key!=="ArrowLeft"&&e.key!=="ArrowRight")return;e.preventDefault();e.stopPropagation();setSourceShare(v=>Math.max(25,Math.min(55,v+(e.key==="ArrowLeft"?-2:2))));}}
        />}
        {hasConceptStage(lesson) ? <ConceptStage lesson={lesson} scene={scene} time={playback.time} reduced={reduced} onInspect={() => playback.seek(frame.index)} onAsk={ask}/> : lesson.topic !== "bubble-sort" ? <CourseConceptScene lesson={lesson} scene={scene} time={playback.time} reduced={reduced} onInspect={() => playback.seek(frame.index)} onAsk={ask}/> : <TeachingCanvas
          lesson={lesson}
          scene={scene}
          time={playback.time}
          reduced={reduced}
          onInspect={() => playback.seek(frame.index)}
          onAsk={ask}
        />}
      </div>
      <div className="motion-step-caption">
        <span className="scene-phase">{frame.from.phase}</span>
        <p aria-live={playback.playing ? "off" : "polite"}>{frame.from.note}</p>
      </div>
      {(conceptWalk(lesson.id)||contrastForLesson(lesson.id))&&<div className="lesson-explore-actions">{conceptWalk(lesson.id)&&<button onClick={()=>{playback.seek(frame.index);setExploration("walk");}}>拆开看关键动作</button>}{contrastForLesson(lesson.id)&&<button onClick={()=>{playback.seek(frame.index);setExploration("contrast");}}>换个条件做对照</button>}</div>}
      {lesson.topic === "bubble-sort" && <BubbleSwapDetail scene={scene} time={playback.time} onInspect={() => playback.seek(frame.index)}/>}
      <div className="scene-output motion-output">
        <span>已完成语句的输出</span>
        <pre>{frame.from.output || "（尚无输出）"}</pre>
      </div>
      <details className="visual-concept-explanation">
        <summary>这幅图说明什么</summary>
        <p>{visual.insight}</p>
        <p>
          点击数据卡可暂停并查看含义。数值使用本课示例快照，拖动时间轴可以往返检查。
        </p>
      </details>
      <div className="visual-footer">
        <span>可随时暂停、拖动时间轴，或用左右键逐步查看</span>
      </div>
      {exploration&&<ConceptExploreDialog lessonId={lesson.id} mode={exploration} onClose={()=>setExploration(undefined)}/>}
      {children}
      </div>
      <div className="visual-transport motion-transport">
        <div className="visual-controls">
          <button
            aria-label="回到第一步"
            title="回到第一步"
            onClick={() => playback.seek(0)}
          >
            <RotateCcw size={16} />
          </button>
          <button
            disabled={playback.time === 0}
            onClick={() =>
              playback.move(Math.max(0, Math.ceil(playback.time) - 1))
            }
          >
            <ChevronLeft size={16} />
            上一步
          </button>
          <button className="play-scene" onClick={()=>{if(!playback.moving)revealStage();playback.toggle();}}>
            {playback.moving ? <Pause size={15} /> : <Play size={15} />}{" "}
            {playback.moving ? "暂停" : reduced ? "继续一步" : "播放"}
          </button>
          <button
            disabled={playback.time >= last}
            onClick={() => playback.move(Math.min(last, frame.index + 1))}
          >
            下一步
            <ChevronRight size={16} />
          </button>
          <label className="scene-speed">
            <span className="sr-only">播放速度</span>
            <SelectControl label="播放速度" compact value={String(playback.speed)} disabled={reduced} onValueChange={value=>playback.setSpeed(Number(value))} options={[0.5,1,2].map(v=>({value:String(v),label:`${v}×`}))}/>
          </label>
        </div>
        <div className="motion-timeline-wrap">
          <div className="motion-timeline-track" aria-hidden="true">
            <div
              style={{ width: `${(playback.time / Math.max(1, last)) * 100}%` }}
            />
            {scene.steps.map((_, i) => (
              <i
                key={i}
                style={{ left: `${(i / Math.max(1, last)) * 100}%` }}
              />
            ))}
          </div>
          <input
            className="scene-timeline motion-timeline"
            type="range"
            aria-label="演示进度"
            aria-valuetext={`第${frame.index + 1}步${destination ? `，前往第${destination}步` : ""}`}
            min={0}
            max={last}
            step={reduced ? 1 : 0.001}
            value={playback.time}
            onKeyDown={(e) => {
              if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
              e.preventDefault();
              e.stopPropagation();
              playback.seek(
                e.key === "ArrowRight"
                  ? Math.min(last, Math.floor(playback.time) + 1)
                  : Math.max(0, Math.ceil(playback.time) - 1),
              );
            }}
            onChange={(e) =>
              playback.seek(
                reduced
                  ? Math.round(Number(e.target.value))
                  : Number(e.target.value),
              )
            }
          />
        </div>
        <div className="motion-playback-status">
          <span>
            <i className={playback.moving ? "running" : ""} />
            {reduced
              ? "逐步查看 · 已减少动效"
              : playback.playing
                ? "连续播放"
                : playback.moving
                  ? "定位到步骤"
                  : playback.time >= last
                    ? "演示结束"
                    : playback.time > 0
                      ? "已暂停"
                      : "准备播放"}
          </span>
          <span>{Math.round((playback.time / Math.max(1, last)) * 100)}%</span>
        </div>
      </div>
    </section>
  );
}
