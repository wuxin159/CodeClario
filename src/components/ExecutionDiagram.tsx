import { useEffect, useState } from "react";
import type { TraceStep, TraceValue } from "../../shared/flow";
import ExecutionPointerGraph from "./ExecutionPointerGraph";
import {
  observedValues,
  flattenedValues,
  sameFrameAfter,
  observedOperation,
} from "../../shared/executionView";

export default function ExecutionDiagram({
  steps,
  position,
  code,
  phase = 0,
  moving = false,
  focusedVariable,
}: {
  steps: TraceStep[];
  position: number;
  code: string;
  phase?: number;
  moving?: boolean;
  focusedVariable?: string;
}) {
  const step = steps[position],
    after = sameFrameAfter(steps, position),
    roots = observedValues(step),
    all = flattenedValues(roots),
    op = observedOperation(code, step, after);
  const nextPoint = steps[position + 1],
    outputChanges = !!nextPoint && nextPoint.output !== step.output;
  const addedOutput = outputChanges
    ? nextPoint.output.startsWith(step.output)
      ? nextPoint.output.slice(step.output.length)
      : nextPoint.output
    : "";
  const [manual, setManual] = useState<string | null>(null),
    [inspected, setInspected] = useState<string | null>(null);
  const [pointerName, setPointerName] = useState("");
  useEffect(() => setPointerName(""), [focusedVariable]);
  useEffect(() => setInspected(null), [position]);
  const pointers = all.filter(
    (n) => (n.kind === "pointer" || n.kind === "reference") && !n.unavailable,
  );
  const objects = roots.some((n) => n.kind === "object" || n.kind === "array");
  const view =
    manual ??
    (pointers.length || objects
      ? "objects"
      : step.stack.length > 1
        ? "calls"
        : "values");
  const pointer =
      pointers.find((n) => n.name === (pointerName || focusedVariable)) ??
      pointers[0],
    frameNodes = step.frames?.flatMap((f) => flattenedValues(f.data)) ?? all;
  const target = pointer?.target
    ? frameNodes.find(
        (n) =>
          n.kind !== "pointer" &&
          n.kind !== "reference" &&
          n.address === pointer.target,
      )
    : undefined;
  const clip = (v: string, n = 25) =>
    Array.from(v).length > n ? Array.from(v).slice(0, n).join("") + "…" : v;
  const svgClip = (v: string, max = 9) => {
    let width = 0,
      out = "";
    for (const ch of Array.from(v)) {
      const next = /[^\u0000-\u00ff]/.test(ch) ? 1 : 0.56;
      if (width + next > max - 1) return out + "…";
      width += next;
      out += ch;
    }
    return out;
  };
  const nodeCard = (node: TraceValue) => {
    const next = after
      ? flattenedValues(observedValues(after)).find((n) => n.name === node.name)
      : undefined;
    return (
      <button
        className={
          "observed-value " +
          (node.name === focusedVariable ? "focused " : "") +
          (next && next.value !== node.value ? "will-change" : "")
        }
        key={node.name}
        onClick={() => setInspected(inspected === node.name ? null : node.name)}
        title={node.type + " " + node.name + " = " + node.value}
      >
        <span>
          {node.name}
          <small>{node.type}</small>
        </span>
        <strong>{clip(node.value, 48)}</strong>
        {next && next.value !== node.value && (
          <small>下次观察：{clip(next.value, 32)}</small>
        )}
      </button>
    );
  };
  return (
    <section
      className="execution-diagram"
      aria-label="自己代码的执行图形"
      data-position={position}
    >
      <nav aria-label="执行图形观察方式">
        {[
          ["values", "变量与运算"],
          ["calls", "函数调用"],
          ["objects", "对象与指针"],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-pressed={view === id}
            onClick={() => setManual(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="observed-path" aria-label="实际停靠路径">
        {steps.slice(Math.max(0, position - 6), position + 1).map((s, i) => (
          <span
            className={i === Math.min(6, position) ? "current" : ""}
            key={position - 6 + i}
          >
            {s.event === "return" ? "结束" : "第" + s.line + "行"}
            <small>
              {s.scope === "<module>" ? "主程序" : clip(s.scope, 15)}
            </small>
          </span>
        ))}
      </div>
      {view === "values" && (
        <>
          <svg
            className="execution-transfer"
            viewBox="0 0 640 148"
            role="img"
            aria-label="当前值和下次观察到的状态"
          >
            <defs>
              <marker
                id="observed-arrow"
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
              y="18"
              width="244"
              height="104"
              rx="12"
              fill="#f0f6ff"
              stroke="#b9cfee"
            />
            <rect
              x="378"
              y="18"
              width="250"
              height="104"
              rx="12"
              fill="#eaf7fb"
              stroke="#9dccdf"
            />
            <text x="30" y="44" className="execution-svg-label">
              {svgClip("当前观察 · " + step.scope, 12)}
            </text>
            <text x="395" y="44" className="execution-svg-label">
              {after ? "下次回到本作用域" : "后续状态"}
            </text>
            <text x="30" y="80" className="execution-svg-value">
              {op.kind === "assignment"
                ? svgClip(
                    (op.before ?? "待赋值") +
                      " " +
                      op.operator +
                      " " +
                      op.expression,
                    9,
                  )
                : step.event === "return"
                  ? "作用域已结束"
                  : svgClip(op.statement || "准备执行")}
            </text>
            <text x="395" y="80" className="execution-svg-value">
              {op.kind === "assignment" && op.result !== undefined
                ? svgClip(op.target + " = " + op.result)
                : after
                  ? "第" + after.line + "行之前"
                  : "后续未采集"}
            </text>
            <path
              d="M263,70 L368,70"
              stroke="#2876c8"
              strokeWidth="2"
              markerEnd="url(#observed-arrow)"
            />
            <circle
              cx={moving ? 270 + Math.max(0, Math.min(1, phase)) * 85 : 315}
              cy="70"
              r="8"
              fill="#2676d3"
            />
            <text
              x="319"
              y="108"
              textAnchor="middle"
              className="execution-svg-label"
            >
              真实状态
            </text>
          </svg>
          {op.kind === "assignment" && op.operands.length > 0 && (
            <p className="observed-operands">
              读取{" "}
              {op.operands.map((o) => (
                <code key={o.name}>
                  {o.name} = {o.value}
                </code>
              ))}
              <span>结果取自后续采集，不用动画估算</span>
            </p>
          )}
          <div className="observed-values">
            {roots.slice(0, 8).map(nodeCard)}
          </div>
        </>
      )}
      {view === "calls" && (
        <div className="observed-frames">
          {(
            step.frames ??
            [...step.stack].reverse().map((name, i) => ({
              name,
              line: i === 0 ? step.line : 0,
              values: i === 0 ? step.values : {},
              data: i === 0 ? roots : [],
            }))
          )
            .slice(0, 6)
            .reverse()
            .map((frame, i, visible) => (
              <article key={frame.name + ":" + i}>
                <header>
                  <b>{frame.name}</b>
                  <small>
                    {i === visible.length - 1
                      ? "当前正在这里"
                      : "调用处的当前值"}
                  </small>
                </header>
                <div className="observed-values">
                  {frame.data.map(nodeCard)}
                </div>
              </article>
            ))}
          {step.returned && (
            <p>
              实际返回：<strong>{step.returned}</strong>
            </p>
          )}
        </div>
      )}
      {view === "objects" && (
        <>
          {pointers.length > 1 && (
            <label className="observed-pointer-choice">
              观察指向关系{" "}
              <select
                aria-label="观察哪个指针或引用"
                value={pointer?.name}
                onChange={(e) => setPointerName(e.target.value)}
              >
                {pointers.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {pointer && (
            <ExecutionPointerGraph
              step={step}
              after={after === nextPoint ? after : undefined}
              pointer={pointer}
              phase={phase}
              moving={moving}
            />
          )}
          <div className="observed-objects">
            {roots
              .filter(
                (n) =>
                  n.kind === "array" ||
                  n.kind === "object" ||
                  n.kind === "pointer" ||
                  n.kind === "reference",
              )
              .map((node) => (
                <article key={node.name}>
                  <header>
                    <b>{node.name}</b>
                    <small>{node.type}</small>
                  </header>
                  <div className="observed-members">
                    {node.children?.length ? (
                      node.children.map((child) => (
                        <div key={child.name}>
                          <span>{child.name}</span>
                          <strong>{clip(child.value, 34)}</strong>
                          {child.children && (
                            <small>
                              {child.children
                                .map((c) => c.name + "=" + c.value)
                                .join(" · ")}
                            </small>
                          )}
                        </div>
                      ))
                    ) : (
                      <p>{node.value}</p>
                    )}
                  </div>
                  {node.size !== undefined &&
                    node.size > (node.children?.length ?? 0) && (
                      <small>
                        共{node.size}项，当前展开前{node.children?.length ?? 0}
                        项。
                      </small>
                    )}
                </article>
              ))}
          </div>
          {!pointers.length && !objects && (
            <p>当前步骤还没有可观察的对象或指针，先沿时间轴看看声明和赋值。</p>
          )}
        </>
      )}
      {inspected && (
        <p className="observed-inspection">
          {inspected}在当前作用域中保存的值是
          {roots.find((n) => n.name === inspected)?.value}。
          {after
            ? "下次同作用域的值来自第" + after.line + "行之前的采集。"
            : "当前作用域后续没有更多已采集值。"}
        </p>
      )}
      <p className="observed-output">
        <span>截至此步的输出</span>
        <code>{step.output || "（尚无输出）"}</code>
      </p>
      {outputChanges && (
        <div className="observed-output-transfer">
          <span>下个观察点收到的片段</span>
          <code>{addedOutput || "（无新增文字）"}</code>
          <span aria-hidden="true">→</span>
          <div>
            <small>加入后累计输出</small>
            <pre>{nextPoint.output}</pre>
          </div>
        </div>
      )}
    </section>
  );
}
