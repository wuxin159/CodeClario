import { useEffect, useState } from "react";
import type { Scene } from "../../shared/scenes";
import { ease, sceneFrame } from "../../shared/sceneMotion";
import "../bubble-sort.css";

export default function BubbleSortDiagram({ scene, time, reduced = false, onInspect }: {
  scene: Scene; time: number; reduced?: boolean; onInspect?: () => void;
}) {
  const frame = sceneFrame(scene, time), current = frame.from.bubble!, next = frame.to.bubble!;
  const [inspection, setInspection] = useState("");
  useEffect(() => setInspection(""), [scene.id, frame.index]);
  const progress = reduced ? 0 : ease(frame.progress);
  const exchanging = next.phase === "swap" && current.phase === "compare" && progress > 0;
  const width = 560, gap = 440 / Math.max(1, current.items.length - 1), barWidth = Math.min(64, gap * .66);
  const numbers = current.items.map(item => item.value), min = Math.min(...numbers), max = Math.max(...numbers);
  const inspect = (index: number, value: number) => { onInspect?.(); setInspection(`下标${index}保存${value}。${index >= current.sortedFrom ? "这里已经就位，后续轮次不再比较它。" : "这个位置仍在本轮待处理区域。"}`); };
  return <div className="bubble-diagram" data-phase={current.phase} data-step={frame.index} data-array={JSON.stringify(numbers)} role="group" aria-label="冒泡排序数组状态">
    <div className="bubble-state-row"><strong>{current.phase === "done" ? "全部就位" : current.passIndex < 0 ? "准备比较" : `第 ${current.passIndex + 1} / ${numbers.length - 1} 轮`}</strong><span>比较 {current.comparisons} 次 <i/> 交换 {current.swaps} 次</span></div>
    <svg viewBox={`0 -20 ${width} 306`} role="group" aria-label={numbers.map((value, index) => `下标${index}为${value}`).join("，")}>
      {current.sortedFrom < numbers.length && <rect x={60 + current.sortedFrom * gap - barWidth / 2 - 13} y="23" width={(numbers.length - 1 - current.sortedFrom) * gap + barWidth + 26} height="234" rx="12" className="bubble-settled-area"/>}
      {current.items.map((item, index) => {
        const destination = next.items.findIndex(other => other.key === item.key);
        // 元素身份不依赖数值，因此重复项仍是不同元素；只插值几何，绝不插值语义数值。
        const moving = exchanging && destination !== index;
        const slot = moving ? index + (destination - index) * progress : index;
        const arc = moving ? Math.sin(Math.PI * progress) * (destination > index ? -20 : -5) : 0;
        const x = 60 + slot * gap, height = 64 + (max === min ? .5 : (item.value - min) / (max - min)) * 110;
        const active = current.pair !== null && (index === current.pair || index === current.pair + 1);
        const sorted = index >= current.sortedFrom;
        return <g key={item.key} transform={`translate(${x} ${arc})`} className={`bubble-bar ${active ? "is-active" : ""} ${sorted ? "is-sorted" : ""} ${moving ? "is-moving" : ""}`} role="button" tabIndex={0} aria-label={`下标${index}，数值${item.value}${sorted ? "，已就位" : ""}`} onClick={() => inspect(index, item.value)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); inspect(index, item.value); } }}>
          <rect x={-barWidth / 2} y={220 - height} width={barWidth} height={height} rx="7"/>
          <text x="0" y={207 - height} textAnchor="middle" className="bubble-value">{item.value}</text>
          {active && <path d={`M-11 ${228}h22`} className="bubble-pair-mark"/>}
        </g>;
      })}
      {numbers.map((_, index) => <g key={index} transform={`translate(${60 + index * gap} 0)`}><text x="0" y="251" textAnchor="middle" className="bubble-index">{index}</text>{current.pair !== null && (index === current.pair || index === current.pair + 1) && <text x="0" y="276" textAnchor="middle" className="bubble-pointer">{index === current.pair ? "j" : "j + 1"}</text>}</g>)}
    </svg>
    <div className="bubble-legend"><span><i/>待处理</span><span><i/>正在比较</span><span><i/>已就位</span></div>
    <div className="bubble-inspection">{inspection || (exchanging ? "交换相邻两项；数值保持不变，位置沿路径移动。" : current.phase === "settled" ? "右侧已就位区域扩大，下一轮从左边重新开始。" : "下标表示位置，柱上的数字表示这个位置中的值。")}</div>
  </div>;
}
