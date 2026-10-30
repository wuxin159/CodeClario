import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { RunResult } from "../../shared/curriculum";
import { useScenePlayback } from "../hooks/useScenePlayback";
import ExecutionDiagram from "./ExecutionDiagram";

export default function ExecutionReplay({
  result,
  code,
  stale,
  focus,
  context,
  onViewedStep,
}: {
  result: RunResult | null;
  code: string;
  stale: boolean;
  focus?: { step: number; nonce: number; variable?: string };
  context: string;
  onViewedStep?: (index: number) => void;
}) {
  const [position, setPosition] = useState(0),
    [reduced, setReduced] = useState(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  const source = useRef<HTMLDivElement>(null);
  const trace = result?.trace;
  // 始终回放运行记录里的快照；当前草稿有改动时仅提示过期，不替换历史源码或轨迹。
  const steps = trace?.steps ?? [];
  const playback = useScenePlayback({
    sceneId: result?.id ?? "empty",
    count: Math.max(1, steps.length),
    position,
    onPosition: setPosition,
    context,
    reduced,
  });
  useEffect(() => {
    setPosition(0);
  }, [result?.id]);
  useEffect(() => {
    if (focus && steps.length) {
      setPosition(Math.max(0, Math.min(steps.length - 1, focus.step - 1)));
      playback.seek(focus.step - 1);
    }
  }, [focus?.nonce]);
  const step = steps[position],
    previous = steps[Math.max(0, position - 1)];
  useEffect(
    () => onViewedStep?.(position),
    [position, result?.id, onViewedStep],
  );
  useEffect(() => {
    // 只滚动代码框内部，避免每次执行步定位都把整页和正在阅读的 AI 讲解带走。
    const row = source.current?.querySelector<HTMLElement>(
      `[data-line="${step?.line}"]`,
    );
    const box = source.current;
    if (
      row &&
      box &&
      (row.offsetTop < box.scrollTop ||
        row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight)
    )
      box.scrollTo({
        top: Math.max(0, row.offsetTop - box.clientHeight / 2),
        behavior: reduced ? "instant" : "smooth",
      });
  }, [step?.line, reduced]);
  if (!result)
    return (
      <div className="replay-empty">
        <h3>回放你的真实执行过程</h3>
        <p>
          运行自己的代码后，在这里观察实际变量、运算、函数调用和对象关系。修改数值或循环边界，再运行就会生成新的图形。
        </p>
      </div>
    );
  if (trace?.status !== "available" || !steps.length)
    return (
      <div className="replay-empty">
        <h3>本次没有可用回放</h3>
        <p>{trace?.reason ?? "此运行未采集到轨迹。"}</p>
        <small>
          采集范围因语言和语法而异；没有取得状态时，普通运行结果仍保留，也可单独查看课程示例。
        </small>
      </div>
    );
  return (
    <div className="execution-replay">
      <div className="replay-provenance">
        <b>学生代码 · 真实执行回放</b>
        <small>绑定本次代码与标准输入</small>
      </div>
      {stale && (
        <p className="flow-stale">当前编辑内容已变化，此处为旧版本快照。</p>
      )}
      {trace.truncated && (
        <p className="flow-stale">
          仅保留前{steps.length}个事件，后续已截断；不据此判断最终值和完整次数。
        </p>
      )}
      <div className="replay-controls">
        <button
          aria-label="回放上一步"
          disabled={position === 0}
          onClick={() => playback.move(position - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          aria-label={playback.playing ? "暂停真实回放" : "播放真实回放"}
          onClick={playback.toggle}
        >
          {playback.playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          aria-label="回放下一步"
          disabled={position >= steps.length - 1}
          onClick={() => playback.move(position + 1)}
        >
          <ChevronRight size={16} />
        </button>
        <span>
          {position + 1} / {steps.length}
        </span>
        <select
          aria-label="真实回放速度"
          value={playback.speed}
          onChange={(e) => playback.setSpeed(Number(e.target.value))}
        >
          {[0.5, 1, 2, 4].map((v) => (
            <option key={v} value={v}>
              {v}×
            </option>
          ))}
        </select>
        <label>
          <input
            type="checkbox"
            checked={reduced}
            onChange={(e) => setReduced(e.target.checked)}
          />
          减少动效
        </label>
      </div>
      <input
        type="range"
        aria-label="真实回放进度"
        min={0}
        max={steps.length - 1}
        step={0.01}
        value={playback.time}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            playback.seek(
              e.key === "ArrowRight"
                ? Math.min(steps.length - 1, Math.floor(playback.time) + 1)
                : Math.max(0, Math.ceil(playback.time) - 1),
            );
          }
        }}
        onChange={(e) => playback.seek(Number(e.target.value))}
      />
      <p className="replay-step-caption">
        第{step.line}行 ·{" "}
        {step.event === "line"
          ? "即将执行（下方是执行前状态）"
          : step.event === "return"
            ? "作用域执行结束"
            : "捕获到异常事件"}
      </p>
      {trace.notice && (
        <details className="trace-provenance">
          <summary>这份回放怎样采集</summary>
          <p>{trace.notice}</p>
        </details>
      )}
      <div className="replay-stage">
        <div className="replay-source" ref={source}>
          {code.split("\n").map((line, i) => (
            <div
              key={i}
              data-line={i + 1}
              className={step.line === i + 1 ? "active" : ""}
            >
              <span>{i + 1}</span>
              <code>{line || " "}</code>
            </div>
          ))}
        </div>

        <ExecutionDiagram
          steps={steps}
          position={position}
          code={code}
          phase={playback.time - Math.floor(playback.time)}
          moving={playback.moving}
          focusedVariable={focus?.variable}
        />
      </div>
    </div>
  );
}
