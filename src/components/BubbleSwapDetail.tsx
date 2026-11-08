import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { Scene } from "../../shared/scenes";
import { sceneFrame } from "../../shared/sceneMotion";

export default function BubbleSwapDetail({ scene, time, onInspect }: { scene: Scene; time: number; onInspect: () => void }) {
  const { index, from } = sceneFrame(scene, time);
  const [step, setStep] = useState(0);
  useEffect(() => setStep(0), [scene.id, index]);
  const current = from.bubble;
  // 拆解只取当前交换的审校前状态；这份局部解释不改主时间轴，也不冒充学生程序轨迹。
  const before = current?.phase === "swap" ? scene.steps[index - 1]?.bubble : current;
  const available = before?.phase === "compare" && before.comparison && before.pair !== null;
  if (!available || !before || before.pair === null) return <div className="swap-hint">到需要交换的两项时，可以展开查看 temp 的作用。</div>;
  const pair = before.pair, left = before.items[pair].value, right = before.items[pair + 1].value;
  return <details className="classroom-swap" onToggle={event => { if (event.currentTarget.open) onInspect(); }}>
    <summary>展开这次交换 · temp 怎样保留旧值</summary>
    <div className="swap-values"><span><small>numbers[{pair}]</small><b>{step >= 2 ? right : left}</b></span><ArrowRight size={18}/><span><small>temp</small><b>{step >= 1 ? left : "—"}</b></span><ArrowRight size={18}/><span><small>numbers[{pair + 1}]</small><b>{step >= 3 ? left : right}</b></span></div>
    <div className="swap-steps">{["保存到 temp", "写入左侧", "写回右侧"].map((text, i) => <button key={text} aria-pressed={step === i + 1} onClick={() => { onInspect(); setStep(i + 1); }}>{i + 1}. {text}</button>)}</div>
    <p aria-live="polite">{["分解演示：先保留左边的旧值，再修改数组。", `temp = ${left}，旧值有了临时存放处。`, `左侧写入${right}；此时两格都是${right}，原来的${left}仍在temp中。`, `右侧写入temp中的${left}，两项交换完成。`][step]}</p>
  </details>;
}
