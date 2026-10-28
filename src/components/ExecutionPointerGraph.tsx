import type { TraceStep, TraceValue } from "../../shared/flow";
import { flattenedValues, observedValues } from "../../shared/executionView";
export default function ExecutionPointerGraph({
  step,
  after,
  pointer,
  phase,
  moving,
}: {
  step: TraceStep;
  after?: TraceStep;
  pointer: TraceValue;
  phase: number;
  moving: boolean;
}) {
  const roots =
    step.frames
      ?.slice()
      .reverse()
      .flatMap((f) => f.data) ?? observedValues(step);
  const all = [...roots, ...flattenedValues(roots)];
  const type = (v: string) =>
    v.replace(/\b(struct|class|const)\s+/g, "").trim();
  const pointedType =
    pointer.children?.[0]?.type ?? pointer.type.replace(/[&*]\s*$/, "").trim();
  const candidates = all.filter(
    (n) =>
      n.address &&
      !n.unavailable &&
      n.kind !== "pointer" &&
      n.kind !== "reference" &&
      type(n.type) === type(pointedType),
  );
  const byAddress = new Map<string, TraceValue>();
  for (const n of candidates)
    if (n.address && !byAddress.has(n.address)) byAddress.set(n.address, n);
  const unique = [...byAddress.values()];
  // Prefer source-level names over the dereference aliases when they share storage.
  for (let i = 0; i < unique.length; i++) {
    const root = roots.find(
      (n) =>
        n.address === unique[i].address &&
        n.kind !== "pointer" &&
        n.kind !== "reference" &&
        !n.unavailable,
    );
    if (root && type(root.type) === type(pointedType)) unique[i] = root;
  }
  const current =
    unique.find((n) => n.address === pointer.target) ?? pointer.children?.[0];
  const nextPointer = after
    ? flattenedValues(observedValues(after)).find(
        (n) => n.name === pointer.name,
      )
    : undefined;
  const desired = new Set([pointer.target, nextPointer?.target]);
  const chosen = new Set(
    unique.filter((n) => desired.has(n.address)).map((n) => n.address),
  );
  for (const n of unique) {
    if (chosen.size >= 3) break;
    chosen.add(n.address);
  }
  let nodes = unique.filter((n) => chosen.has(n.address));
  if (!nodes.length && current) nodes = [current];
  const height = Math.max(154, nodes.length * 80 + 26),
    middle = height / 2 - 4;
  const index = nodes.findIndex((n) => n.address === pointer.target),
    nextIndex = nodes.findIndex((n) => n.address === nextPointer?.target);
  const y = index >= 0 ? 50 + index * 80 : middle,
    nextY = nextIndex >= 0 ? 50 + nextIndex * 80 : y;
  const p = moving ? Math.max(0, Math.min(1, phase)) : 0,
    head = y + (nextY - y) * p;
  const clip = (s: string, max = 9) => {
    let count = 0,
      out = "";
    for (const c of Array.from(s)) {
      let width = /[^\u0000-\u00ff]/.test(c) ? 1 : 0.56;
      if (count + width > max - 1) return out + "…";
      count += width;
      out += c;
    }
    return out;
  };
  return (
    <svg
      className="execution-pointer"
      viewBox={"0 0 640 " + height}
      role="img"
      aria-label={pointer.name + "指向" + (current?.name ?? "已采集地址")}
    >
      <defs>
        <marker
          id="actual-pointer-arrow"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6" fill="#2876c8" />
        </marker>
      </defs>
      <rect
        x="12"
        y={middle - 48}
        width="202"
        height="96"
        rx="12"
        fill="#edf4ff"
        stroke="#a8c5ec"
      />
      <text x="28" y={middle - 17} className="execution-svg-label">
        {clip(pointer.name + " · 保存位置", 10)}
      </text>
      <text x="28" y={middle + 17} className="execution-svg-value">
        {pointer.target === "0x0"
          ? "空指针"
          : clip("指向 " + (current?.name ?? "所指对象"))}
      </text>
      {pointer.target !== "0x0" && (
        <>
          <path
            d={
              "M221," +
              middle +
              " C280," +
              middle +
              " 300," +
              head +
              " 353," +
              head
            }
            fill="none"
            stroke="#2876c8"
            strokeWidth="3"
            markerEnd="url(#actual-pointer-arrow)"
          />
          {moving && (
            <circle
              cx={225 + 120 * p}
              cy={middle + (head - middle) * p}
              r="7"
              fill="#32a9c5"
            />
          )}
        </>
      )}
      {nodes.map((node, i) => (
        <g key={node.address ?? node.name}>
          <rect
            x="365"
            y={18 + i * 80}
            width="263"
            height="64"
            rx="10"
            fill={i === index ? "#e3f4fb" : "#f8fbfe"}
            stroke={i === index ? "#68afca" : "#d2e1ed"}
            strokeWidth={i === index ? 2 : 1}
          />
          <text x="384" y={42 + i * 80} className="execution-svg-label">
            {clip(node.name, 13)}
          </text>
          <text x="384" y={68 + i * 80} className="execution-svg-value">
            {clip(node.value)}
          </text>
        </g>
      ))}
      {!nodes.length && (
        <text x="384" y={middle} className="execution-svg-label">
          没有可读的目标对象
        </text>
      )}
      <text
        x="319"
        y={height - 3}
        textAnchor="middle"
        className="execution-svg-label"
      >
        {nextPointer?.target && nextPointer.target !== pointer.target
          ? "位置关系随下一步改变；原对象仍保留"
          : "箭头匹配本次采集的真实对象位置"}
      </text>
    </svg>
  );
}
