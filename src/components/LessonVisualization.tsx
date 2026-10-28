import { useEffect, useState } from "react";
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
import TeachingCanvas from "./TeachingCanvas";
import MotionSource from "./MotionSource";

export default function LessonVisualization({
  lesson,
  scene,
  options,
  onOptions,
  position,
  onPosition,
  playbackContext,
}: {
  lesson: Lesson;
  scene: Scene;
  options: SceneOptions;
  onOptions: (o: SceneOptions) => void;
  position: number;
  onPosition: (n: number) => void;
  playbackContext: string;
}) {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const playback = useScenePlayback({
    sceneId: scene.id,
    count: scene.steps.length,
    position,
    onPosition,
    context: playbackContext,
    reduced,
  });
  const frame = sceneFrame(scene, playback.time);
  const visual = visualLesson(lesson);
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
  return (
    <section
      className={`lesson-visualization motion-visualization ${reduced ? "reduced" : ""}`}
      aria-label="本课可视化"
      tabIndex={0}
      onKeyDown={(e) => {
        if (
          (e.target as HTMLElement).closest("input,select,textarea,button,pre")
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
      <div className="visual-heading">
        <div>
          <h2 title={scene.title}>{visual.question}</h2>
        </div>
        <span className="visual-step-number">{stepLabel}</span>
      </div>
      <p className="visual-provenance">
        课程示例 · 用固定代码与图形讲解本节概念
      </p>
      {lesson.index < 6 && (
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
          <button className="play-scene" onClick={playback.toggle}>
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
            <select
              aria-label="播放速度"
              value={playback.speed}
              disabled={reduced}
              onChange={(e) => playback.setSpeed(Number(e.target.value))}
            >
              <option value={0.5}>0.5×</option>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
            </select>
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
      <div className="motion-stage" role="group" aria-label="示例代码与动画">
        <MotionSource
          code={scene.code}
          fromLine={frame.from.line}
          toLine={frame.to.line}
          progress={reduced ? 0 : frame.progress}
          reduced={reduced}
          language={
            lesson.language === "python"
              ? "Python"
              : lesson.language === "cpp"
                ? "C++"
                : "C"
          }
        />
        <TeachingCanvas
          lesson={lesson}
          scene={scene}
          time={playback.time}
          reduced={reduced}
          onInspect={() => playback.seek(frame.index)}
        />
      </div>
      <div className="motion-step-caption">
        <span className="scene-phase">{frame.from.phase}</span>
        <p aria-live={playback.playing ? "off" : "polite"}>{frame.from.note}</p>
      </div>
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
        <label>
          <input
            type="checkbox"
            checked={reduced}
            onChange={(e) => setReduced(e.target.checked)}
          />
          减少动效
        </label>
      </div>
    </section>
  );
}
