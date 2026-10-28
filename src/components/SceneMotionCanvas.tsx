import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { Scene } from "../../shared/scenes";
import {
  changedValues,
  curvePoint,
  ease,
  lerp,
  motionFamily,
  objectLinksAt,
  sceneFrame,
  sequenceAt,
} from "../../shared/sceneMotion";

const short = (value: unknown, max = 18) => {
  const text = String(value ?? "—").replace(/\n/g, " ↵ ");
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
};
function Value({
  before,
  after,
  x,
  y,
  progress,
  large = false,
  limit = 20,
}: {
  before: unknown;
  after: unknown;
  x: number;
  y: number;
  progress: number;
  large?: boolean;
  limit?: number;
}) {
  const changed = before !== after;
  const fade = changed
    ? ease(Math.max(0, Math.min(1, (progress - 0.65) / 0.35)))
    : 0;
  const weightedLength = (value: unknown) =>
    Array.from(short(value, limit)).reduce(
      (sum, char) => sum + (char.charCodeAt(0) > 255 ? 2 : 1),
      0,
    );
  const big =
    large && Math.max(weightedLength(before), weightedLength(after)) <= 8;
  return (
    <g
      className={big ? "motion-value large" : "motion-value"}
      data-before={String(before ?? "—")}
      data-after={String(after ?? "—")}
    >
      <title>{`${String(before ?? "—")}${changed ? ` → ${String(after ?? "—")}` : ""}`}</title>
      <text
        x={x}
        y={y}
        opacity={1 - fade}
        transform={`translate(0 ${-fade * 7})`}
      >
        {short(before, Math.min(limit, large ? 16 : 20))}
      </text>
      {changed && (
        <text
          x={x}
          y={y}
          opacity={fade}
          transform={`translate(0 ${(1 - fade) * 7})`}
        >
          {short(after, Math.min(limit, large ? 16 : 20))}
        </text>
      )}
    </g>
  );
}
function Box({
  x,
  y,
  w = 130,
  h = 70,
  label,
  children,
  opacity = 1,
  active = 0,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  label: string;
  children?: ReactNode;
  opacity?: number;
  active?: number;
}) {
  return (
    <g transform={`translate(${x} ${y})`} opacity={opacity}>
      <rect
        width={w}
        height={h}
        rx={12}
        fill={active > 0 ? "#edf5ef" : "#fff"}
        stroke={active > 0 ? "#86af98" : "#d7e3dc"}
        strokeWidth={1 + active}
      />
      <text className="motion-label" x={14} y={22}>
        {short(label, 26)}
      </text>
      {children}
    </g>
  );
}
function Flow({
  from,
  to,
  progress,
  bend = 0,
  label = "",
  active = true,
  id,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  progress: number;
  bend?: number;
  label?: string;
  active?: boolean;
  id: string;
}) {
  const middle = {
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2 + bend * 1.5,
  };
  const path = `M ${from.x} ${from.y} Q ${middle.x} ${middle.y} ${to.x} ${to.y}`;
  const point = curvePoint(from, to, ease(progress), bend);
  return (
    <g className="motion-flow">
      <path
        d={path}
        fill="none"
        stroke={active ? "#95bba5" : "#dfe7e2"}
        strokeWidth={2}
        markerEnd={`url(#${id})`}
      />
      {label && (
        <text
          className="motion-edge-label"
          x={middle.x}
          y={middle.y - 10}
          textAnchor="middle"
        >
          {short(label, 22)}
        </text>
      )}
      {active && progress > 0 && progress < 1 && (
        <g
          className="motion-packet"
          transform={`translate(${point.x} ${point.y})`}
          data-progress={progress}
        >
          <circle r={12} fill="#276c51" opacity={0.12} />
          <circle r={5} fill="#276c51" />
          <circle r={2} fill="#eaffd9" />
        </g>
      )}
    </g>
  );
}
export default function SceneMotionCanvas({
  scene,
  time,
  reduced,
}: {
  scene: Scene;
  time: number;
  reduced: boolean;
}) {
  const wrapper = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(520);
  const id = useId().replace(/:/g, "");
  useEffect(() => {
    const element = wrapper.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) =>
      setWidth(Math.max(250, entries[0].contentRect.width)),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const { from, to, progress, index } = sceneFrame(scene, time);
  const p = reduced ? 0 : progress;
  const family = motionFamily(scene);
  const narrow = width < 430;
  const height =
    family === "objects"
      ? Math.max(
          186,
          scene.steps.reduce(
            (max, s) => Math.max(max, s.links?.length ?? 0),
            0,
          ) *
            120 +
            36,
        )
      : family === "sequence"
        ? 285
        : 280;
  const activeKeys = changedValues(from, to);
  const keys = [
    ...new Set(scene.steps.flatMap((step) => Object.keys(step.values))),
  ].slice(0, 6);
  const blend = (before: boolean, after: boolean) =>
    lerp(Number(before), Number(after), ease(p));
  let content: ReactNode;
  if (family === "objects") {
    const fromLinks = objectLinksAt(scene, index),
      toLinks = objectLinksAt(
        scene,
        Math.min(index + 1, scene.steps.length - 1),
      );
    const rows = scene.steps.reduce(
      (max, s) => Math.max(max, s.links?.length ?? 0),
      0,
    );
    const compact = width < 340,
      margin = compact ? 12 : 18;
    const leftW = compact ? 72 : narrow ? 86 : 112,
      rightW = compact ? 118 : narrow ? 134 : Math.min(200, width * 0.36),
      rightX = width - rightW - margin;
    content = Array.from({ length: rows }, (_, i) => {
      const a = fromLinks[i],
        b = toLinks[i],
        reference = a ?? b;
      if (!reference) return null;
      const rowY = 40 + i * 120;
      const fields = [
        ...new Set([
          ...Object.keys(a?.fields ?? {}),
          ...Object.keys(b?.fields ?? {}),
        ]),
      ];
      const presence = blend(!!a, !!b);
      const relationChanged =
        !a ||
        !b ||
        a.from !== b.from ||
        fields.some((key) => a.fields[key] !== b.fields[key]);
      const initialFields = Object.fromEntries(
        fields.map((key) => [
          key,
          from.values[key] ?? from.values[`${reference.to}.${key}`],
        ]),
      );
      const knownInitial = Object.values(initialFields).some(
        (value) => value !== undefined,
      );
      return (
        <g key={i}>
          <Box
            x={margin}
            y={rowY + 14}
            w={leftW}
            h={60}
            label={narrow ? "访问入口" : "名字 / 访问入口"}
            opacity={presence}
          >
            <Value
              before={a?.from}
              after={b?.from}
              x={14}
              y={44}
              progress={p}
              limit={compact ? 8 : narrow ? 10 : 15}
            />
          </Box>
          <g opacity={presence}>
            <Flow
              id={id}
              from={{ x: margin + leftW, y: rowY + 45 }}
              to={{ x: rightX - 6, y: rowY + 45 }}
              progress={p}
              label={a?.label ?? b?.label}
              active={relationChanged}
            />
          </g>
          <Box
            x={rightX}
            y={rowY}
            w={rightW}
            h={Math.max(88, 40 + fields.length * 25)}
            label={reference.to}
            opacity={knownInitial ? 1 : 0.28 + presence * 0.72}
            active={relationChanged && p > 0 ? 0.45 : 0}
          >
            {fields.map((key, j) => (
              <g key={key}>
                <text className="motion-field-name" x={14} y={47 + j * 25}>
                  {short(key, 14)}
                </text>
                <Value
                  x={rightW - 52}
                  y={47 + j * 25}
                  before={a?.fields[key] ?? initialFields[key]}
                  after={
                    b?.fields[key] ??
                    to.values[key] ??
                    to.values[`${reference.to}.${key}`]
                  }
                  progress={p}
                />
              </g>
            ))}
          </Box>
        </g>
      );
    });
  } else if (family === "sequence") {
    const fromItems = sequenceAt(scene, index),
      toItems = sequenceAt(scene, Math.min(index + 1, scene.steps.length - 1));
    const longest = scene.steps.reduce<(string | number)[]>(
      (max, step) =>
        (step.items?.length ?? 0) > max.length ? step.items! : max,
      [],
    );
    const cellW = Math.min(70, (width - 42) / longest.length),
      gap = 6;
    const start = (width - longest.length * cellW) / 2;
    const aIndex = from.active,
      bIndex = to.active;
    const cursorA = aIndex ?? bIndex ?? 0,
      cursorB = bIndex ?? aIndex ?? 0;
    const cursorX =
      start + lerp(cursorA, cursorB, ease(p)) * cellW + cellW / 2 - gap / 2;
    const cursorOpacity = blend(aIndex !== undefined, bIndex !== undefined);
    const totalKey =
      keys.find(
        (key) =>
          key === "total" ||
          key === "sum" ||
          key === "length" ||
          key === "size" ||
          key === "集合大小",
      ) ?? keys[0];
    content = (
      <>
        <text className="motion-section-label" x={20} y={29}>
          序列中的元素
        </text>
        {longest.map((_, i) => (
          <g
            key={i}
            transform={`translate(${start + i * cellW} 56)`}
            opacity={blend(
              fromItems[i] !== undefined,
              toItems[i] !== undefined,
            )}
          >
            <rect
              width={cellW - gap}
              height={66}
              rx={9}
              fill="#fff"
              stroke="#d7e3dc"
            />
            <text
              className="motion-index"
              x={(cellW - gap) / 2}
              y={18}
              textAnchor="middle"
            >
              [{i}]
            </text>
            <g
              transform={`translate(${(cellW - gap) / 2} 0)`}
              textAnchor="middle"
            >
              <Value
                before={fromItems[i]}
                after={toItems[i]}
                x={0}
                y={46}
                progress={p}
                large={
                  Math.max(
                    String(fromItems[i] ?? "").length,
                    String(toItems[i] ?? "").length,
                  ) < 5
                }
              />
            </g>
          </g>
        ))}
        <g
          className="motion-access-cursor"
          transform={`translate(${cursorX} 137)`}
          opacity={cursorOpacity}
          data-x={cursorX}
        >
          <path
            d="M -6 0 L 0 -7 L 6 0"
            fill="none"
            stroke="#216346"
            strokeWidth={2}
          />
          <text y={18} textAnchor="middle">
            当前访问
          </text>
        </g>
        <Flow
          id={id}
          from={{ x: cursorX, y: 159 }}
          to={{ x: width / 2, y: 202 }}
          progress={p}
          bend={10}
          active={!!totalKey && activeKeys.includes(totalKey)}
          label={totalKey ? "读取 / 更新" : ""}
        />
        <Box
          x={width / 2 - 88}
          y={208}
          w={176}
          h={58}
          label={totalKey ?? "本步说明"}
        >
          <Value
            before={totalKey ? from.values[totalKey] : "观察元素"}
            after={totalKey ? to.values[totalKey] : "观察元素"}
            x={110}
            y={35}
            progress={p}
          />
        </Box>
      </>
    );
  } else if (family === "loop") {
    const maxI = Math.min(
      9,
      Math.max(...scene.steps.map((step) => Number(step.values.i) || 0)),
    );
    const cellW = Math.min(48, (width - 36) / maxI),
      start = (width - cellW * maxI) / 2;
    const a = Number(from.values.i ?? to.values.i ?? 1),
      b = Number(to.values.i ?? from.values.i ?? 1);
    const cursorX = start + (lerp(a, b, ease(p)) - 1) * cellW + cellW / 2;
    content = (
      <>
        <text className="motion-section-label" x={18} y={28}>
          循环变量 i 的变化
        </text>
        {Array.from({ length: maxI }, (_, i) => (
          <g key={i} transform={`translate(${start + i * cellW} 48)`}>
            <rect
              width={cellW - 5}
              height={45}
              rx={8}
              fill="#fff"
              stroke="#d7e3dc"
            />
            <text
              className="motion-value"
              x={(cellW - 5) / 2}
              y={29}
              textAnchor="middle"
            >
              {i + 1}
            </text>
          </g>
        ))}
        <g
          className="motion-access-cursor"
          transform={`translate(${cursorX} 107)`}
          data-x={cursorX}
          opacity={blend(
            from.values.i !== undefined,
            to.values.i !== undefined,
          )}
        >
          <path
            d="M -5 0 L 0 -6 L 5 0"
            stroke="#216346"
            fill="none"
            strokeWidth={2}
          />
          <text y={17} textAnchor="middle">
            i
          </text>
        </g>
        <Flow
          id={id}
          from={{ x: width * 0.28, y: 174 }}
          to={{ x: width * 0.7, y: 174 }}
          progress={p}
          bend={-34}
          label="判断 · 累加 · 更新"
          active={activeKeys.includes("total")}
        />
        <Box x={18} y={178} w={narrow ? 100 : 150} h={65} label="循环变量 i">
          <Value
            before={from.values.i}
            after={to.values.i}
            x={14}
            y={47}
            progress={p}
            large
          />
        </Box>
        <Box
          x={width - (narrow ? 118 : 168)}
          y={178}
          w={narrow ? 100 : 150}
          h={65}
          label="累加器 total"
        >
          <Value
            before={from.values.total}
            after={to.values.total}
            x={14}
            y={47}
            progress={p}
            large
          />
        </Box>
      </>
    );
  } else if (family === "branch") {
    const x = width * 0.27,
      y = 140,
      rightX = width - (narrow ? 106 : 142) - 18,
      boxW = narrow ? 106 : 142;
    const chosen = to.branch ?? from.branch,
      diamond = narrow ? 42 : 60;
    content = (
      <>
        <path
          d={`M ${x} ${y - 46} L ${x + diamond} ${y} L ${x} ${y + 46} L ${x - diamond} ${y} Z`}
          fill="#edf5ef"
          stroke="#95bba5"
        />
        <text className="motion-label" x={x} y={y - 10} textAnchor="middle">
          条件判断
        </text>
        <g textAnchor="middle">
          <Value
            before={from.values.age}
            after={to.values.age}
            x={x}
            y={y + 16}
            progress={p}
          />
        </g>
        {[true, false].map((truth, i) => (
          <g key={String(truth)}>
            <Flow
              id={id}
              from={{ x: x + diamond * 0.9, y: y + (i === 0 ? -6 : 6) }}
              to={{ x: rightX - 5, y: 72 + i * 126 }}
              progress={p}
              bend={i === 0 ? -34 : 34}
              label={truth ? "true" : "false"}
              active={chosen === truth}
            />
            <Box
              x={rightX}
              y={40 + i * 126}
              w={boxW}
              h={66}
              label={truth ? "if 分支" : "else 分支"}
              active={blend(from.branch === truth, to.branch === truth)}
            >
              <text className="motion-value" x={14} y={47}>
                {truth ? "adult" : "minor"}
              </text>
            </Box>
          </g>
        ))}
      </>
    );
  } else if (family === "call") {
    const boxW = narrow ? 100 : 150,
      rightX = width - boxW - 18;
    const returning = to.returned !== undefined;
    content = (
      <>
        <Box x={18} y={62} w={boxW} h={88} label="调用处">
          <text className="motion-value" x={14} y={53}>
            square(…)
          </text>
        </Box>
        <Box
          x={rightX}
          y={62}
          w={boxW}
          h={88}
          label="square · 局部帧"
          active={blend(!!from.frame, !!to.frame)}
        >
          <Value
            x={14}
            y={53}
            before={from.values.n ?? "等待调用"}
            after={to.values.n ?? "调用结束"}
            progress={p}
          />
        </Box>
        <Flow
          id={id}
          from={{ x: 18 + boxW, y: 86 }}
          to={{ x: rightX - 5, y: 86 }}
          bend={-48}
          progress={p}
          label="传入参数"
          active={!returning}
        />
        <Flow
          id={id}
          from={{ x: rightX, y: 137 }}
          to={{ x: 18 + boxW + 5, y: 137 }}
          bend={60}
          progress={p}
          label="交还返回值"
          active={returning}
        />
        <Box x={width / 2 - 90} y={210} w={180} h={54} label="返回值">
          <Value
            before={from.returned}
            after={to.returned}
            x={113}
            y={34}
            progress={p}
          />
        </Box>
      </>
    );
  } else {
    const columns = keys.length > 2 ? 2 : Math.max(1, keys.length);
    const cardW = Math.min(180, (width - 48 - (columns - 1) * 12) / columns),
      start = (width - columns * cardW - (columns - 1) * 12) / 2;
    const outputOnly = keys.length === 0;
    content = (
      <>
        <text className="motion-section-label" x={20} y={27}>
          {outputOnly ? "语句按顺序写入输出" : "变量与计算结果"}
        </text>
        {outputOnly ? (
          <>
            <Box x={18} y={65} w={narrow ? 100 : 150} h={76} label="当前语句">
              <Value
                before={`第 ${from.line} 行`}
                after={`第 ${to.line} 行`}
                x={14}
                y={51}
                progress={p}
              />
            </Box>
            <Flow
              id={id}
              from={{ x: narrow ? 118 : 168, y: 104 }}
              to={{ x: width - 136, y: 104 }}
              progress={p}
              label="输出"
            />
            <Box x={width - 130} y={65} w={112} h={76} label="标准输出">
              <Value
                before={short(from.output.trim() || "等待输出", 12)}
                after={short(to.output.trim() || "等待输出", 12)}
                x={14}
                y={51}
                progress={p}
              />
            </Box>
          </>
        ) : (
          keys.map((key, i) => {
            const row = Math.floor(i / columns),
              col = i % columns,
              x = start + col * (cardW + 12),
              y = 50 + row * 72;
            const a = from.values[key],
              b = to.values[key];
            return (
              <g key={key}>
                <Box
                  x={x}
                  y={y}
                  w={cardW}
                  h={62}
                  label={key}
                  active={activeKeys.includes(key) ? Math.sin(p * Math.PI) : 0}
                  opacity={blend(a !== undefined, b !== undefined)}
                >
                  <Value
                    x={14}
                    y={48}
                    before={a}
                    after={b}
                    progress={p}
                    large
                  />
                </Box>
                {activeKeys.includes(key) && p > 0 && (
                  <circle
                    className="motion-write-orbit"
                    cx={x + cardW - 12}
                    cy={y + lerp(12, 50, p)}
                    r={4}
                    fill="#2a7955"
                    opacity={Math.sin(p * Math.PI)}
                  />
                )}
              </g>
            );
          })
        )}
      </>
    );
  }
  return (
    <div
      ref={wrapper}
      className="scene-motion-canvas"
      data-family={family}
      data-playhead={time.toFixed(4)}
      data-progress={progress.toFixed(4)}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={`${scene.title}，${from.note}`}
      >
        <defs>
          <marker
            id={id}
            viewBox="0 0 8 8"
            refX={6}
            refY={4}
            markerWidth={5}
            markerHeight={5}
            orient="auto-start-reverse"
          >
            <path
              d="M 1 1 L 6 4 L 1 7"
              fill="none"
              stroke="#8caf9a"
              strokeWidth={1.5}
            />
          </marker>
        </defs>
        {content}
      </svg>
      <div className="motion-canvas-caption">
        {family === "objects"
          ? "对象关系示意 · 非实际内存地址"
          : "课程概念示意"}
      </div>
    </div>
  );
}
