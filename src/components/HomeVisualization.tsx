import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { findLesson } from "../../shared/curriculum";
import { buildScene } from "../../shared/scenes";
import { sceneFrame } from "../../shared/sceneMotion";
import { useScenePlayback } from "../hooks/useScenePlayback";
import TeachingCanvas from "./TeachingCanvas";
import MotionSource from "./MotionSource";

export default function HomeVisualization() {
  const lesson = findLesson("python-4")!,
    [fixed, setFixed] = useState(false),
    [position, setPosition] = useState(0);
  const [reduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const scene = useMemo(
    () => buildScene(lesson, { fixed, value: 5, text: "Hello!" }),
    [fixed],
  );
  const playback = useScenePlayback({
    sceneId: scene.id,
    count: scene.steps.length,
    position,
    onPosition: setPosition,
    context: "public-loop",
    reduced,
  });
  const frame = sceneFrame(scene, playback.time),
    root = useRef<HTMLDivElement>(null),
    started = useRef(false),
    replayRequested = useRef(false),
    playRef = useRef(playback);
  playRef.current = playback;
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !started.current && !reduced) {
            started.current = true;
            playRef.current.setSpeed(2);
            playRef.current.play();
          } else if (!e.isIntersecting && playRef.current.playing)
            playRef.current.seek(Math.floor(playRef.current.time));
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced]);
  useEffect(() => {
    if (replayRequested.current) {
      replayRequested.current = false;
      if (!reduced) playRef.current.play();
    }
  }, [scene.id, reduced]);
  const chooseVariant = (value: boolean) => {
    setPosition(0);
    if (value !== fixed) {
      replayRequested.current = true;
      setFixed(value);
    } else {
      playback.seek(0);
      if (!reduced) playback.play();
    }
  };
  return (
    <div
      ref={root}
      className="home-demo home-data-demo"
      id="home/demo"
      data-ui
      aria-label="可操作的循环数据流演示"
    >
      <div className="demo-window-bar">
        <span>循环边界 · 看见每次累加</span>
        <span>Python</span>
      </div>
      <div className="demo-switch" aria-label="比较循环边界">
        <button aria-pressed={!fixed} onClick={() => chooseVariant(false)}>
          range(1, 5) · 漏掉5
        </button>
        <button aria-pressed={fixed} onClick={() => chooseVariant(true)}>
          range(1, 6) · 包含5
        </button>
      </div>
      <MotionSource
        code={scene.code}
        fromLine={frame.from.line}
        toLine={frame.to.line}
        progress={reduced ? 0 : frame.progress}
        language="Python"
        reduced={reduced}
      />
      <TeachingCanvas
        lesson={lesson}
        scene={scene}
        time={playback.time}
        reduced={reduced}
        compactView
        onInspect={() => playback.seek(frame.index)}
      />
      <div className="home-data-transport">
        <button
          onClick={playback.toggle}
          aria-label={playback.moving ? "暂停数据流演示" : "播放数据流演示"}
        >
          {playback.moving ? (
            <Pause size={16} />
          ) : playback.time >= scene.steps.length - 1 ? (
            <RotateCcw size={16} />
          ) : (
            <Play size={16} />
          )}{" "}
          {playback.moving ? "暂停" : "播放数据流"}
        </button>
        <input
          aria-label="首页数据流进度"
          type="range"
          min={0}
          max={scene.steps.length - 1}
          step={0.001}
          value={playback.time}
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            playback.seek(
              e.key === "ArrowRight"
                ? Math.min(
                    scene.steps.length - 1,
                    Math.floor(playback.time) + 1,
                  )
                : Math.max(0, Math.ceil(playback.time) - 1),
            );
          }}
          onChange={(e) => playback.seek(Number(e.target.value))}
        />
        <span>
          {frame.index + 1}/{scene.steps.length}
        </span>
      </div>
      <p className="home-data-caption">{frame.from.note}</p>
    </div>
  );
}
