import { useEffect, useId, useState, type ReactNode } from "react";
import type { Lesson } from "../../shared/curriculum";
import type { Scene } from "../../shared/scenes";
import { ease } from "../../shared/sceneMotion";
import { lessonVisualState, visualLesson } from "../../shared/visualLessons";

const compact = (v: unknown, max = 21) => {
  const s = String(v ?? "—");
  const chars = Array.from(s);
  return chars.length > max ? chars.slice(0, max - 1).join("") + "…" : s;
};
type Point = { x: number; y: number };
function routePoint(points: Point[], progress: number): Point {
  const lengths = points
    .slice(1)
    .map((b, i) => Math.hypot(b.x - points[i].x, b.y - points[i].y));
  let distance = lengths.reduce((a, b) => a + b, 0) * ease(progress);
  for (let i = 0; i < lengths.length; i++) {
    if (distance <= lengths[i]) {
      const t = distance / lengths[i];
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * t,
        y: points[i].y + (points[i + 1].y - points[i].y) * t,
      };
    }
    distance -= lengths[i];
  }
  return points[points.length - 1];
}
function Label({
  x,
  y,
  children,
  muted = false,
  anchor = "start",
  big = false,
}: {
  x: number;
  y: number;
  children: ReactNode;
  muted?: boolean;
  anchor?: "start" | "middle" | "end";
  big?: boolean;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      className={`viz-label ${muted ? "muted" : ""} ${big ? "big" : ""}`}
    >
      {children}
    </text>
  );
}
function Card({
  x,
  y,
  w = 160,
  h = 72,
  title,
  value,
  active = false,
  ghost = false,
  children,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  title: string;
  value?: unknown;
  active?: boolean;
  ghost?: boolean;
  children?: ReactNode;
}) {
  const shown = compact(value, 20),
    units = Array.from(shown).reduce(
      (n, c) => n + (c.charCodeAt(0) > 255 ? 1 : 0.56),
      0,
    ),
    size = Math.max(14, Math.min(23, (w - 28) / Math.max(1, units)));
  return (
    <g
      data-inspect={`${title}${value !== undefined ? "：" + String(value) : ""}`}
      role="button"
      tabIndex={0}
      className={`viz-card ${active ? "active" : ""} ${ghost ? "ghost" : ""}`}
      transform={`translate(${x} ${y})`}
    >
      <rect width={w} height={h} rx={10} />
      <Label x={14} y={24} muted>
        {compact(title, 23)}
      </Label>
      {value !== undefined && (
        <text
          className="viz-label big"
          x={14}
          y={h - 17}
          style={{ fontSize: size }}
        >
          {shown}
        </text>
      )}
      {children}
    </g>
  );
}
function Wire({
  a,
  b,
  p = 0,
  active = true,
  label = "",
  bend = 0,
  token,
  id,
}: {
  a: Point;
  b: Point;
  p?: number;
  active?: boolean;
  label?: string;
  bend?: number;
  token?: unknown;
  id: string;
}) {
  const c = {
      x: (a.x + b.x) / 2 + bend,
      y: (a.y + b.y) / 2 - Math.abs(bend) * 0.3,
    },
    q = ease(p),
    x = (1 - q) ** 2 * a.x + 2 * (1 - q) * q * c.x + q * q * b.x,
    y = (1 - q) ** 2 * a.y + 2 * (1 - q) * q * c.y + q * q * b.y;
  const tokenText = compact(token, 6),
    tokenWidth = Math.max(
      38,
      Math.min(
        118,
        Array.from(tokenText).reduce(
          (sum, c) => sum + (c.charCodeAt(0) > 255 ? 1 : 0.56),
          0,
        ) *
          17 +
          20,
      ),
    );
  return (
    <g className={`viz-wire ${active ? "active" : ""}`}>
      <path
        d={`M${a.x},${a.y} Q${c.x},${c.y} ${b.x},${b.y}`}
        markerEnd={`url(#${id})`}
      />
      {label && (
        <Label x={c.x} y={c.y - 12} anchor="middle" muted>
          {label}
        </Label>
      )}
      {active && p > 0 && p < 1 && (
        <g transform={`translate(${x} ${y})`} className="viz-token">
          {token === undefined ? (
            <circle r={7} />
          ) : (
            <rect
              x={-tokenWidth / 2}
              y={-18}
              width={tokenWidth}
              height={36}
              rx={18}
            />
          )}
          {token !== undefined && (
            <text y={6} textAnchor="middle">
              {tokenText}
            </text>
          )}
        </g>
      )}
    </g>
  );
}

export default function TeachingCanvas({
  lesson,
  scene,
  time,
  reduced = false,
  compactView = false,
  onInspect,
}: {
  lesson: Lesson;
  scene: Scene;
  time: number;
  reduced?: boolean;
  compactView?: boolean;
  onInspect?: () => void;
}) {
  const spec = visualLesson(lesson),
    state = lessonVisualState(scene, time),
    { index, from, to, values, items, history, links } = state;
  const p = reduced ? 0 : state.progress,
    id = "viz-" + useId().replace(/:/g, ""),
    [inspection, setInspection] = useState("");
  const changed =
    JSON.stringify(from.values) !== JSON.stringify(to.values) ||
    JSON.stringify(from.items) !== JSON.stringify(to.items) ||
    JSON.stringify(from.links) !== JSON.stringify(to.links) ||
    from.output !== to.output;
  const allItems = scene.steps.reduce<(string | number)[]>(
    (a, s) => ((s.items?.length ?? 0) > a.length ? s.items! : a),
    [],
  );
  const atEnd = index === scene.steps.length - 1;
  useEffect(() => setInspection(""), [scene.id, index]);
  const choose = (text: string) => {
    onInspect?.();
    setInspection(text);
  };
  const cell = (
    value: unknown,
    x: number,
    y: number,
    w: number,
    label: string,
    active = false,
    ghost = false,
    detail?: string,
  ) => (
    <g
      key={`${label}:${x}:${y}`}
      className={`viz-cell ${active ? "active" : ""} ${ghost ? "ghost" : ""}`}
      transform={`translate(${x} ${y})`}
      role="button"
      tabIndex={0}
      aria-label={`${label}：${String(value ?? "尚未产生")}`}
      onClick={() =>
        choose(
          detail ?? `${label}：${String(value ?? "尚未产生")}。${from.note}`,
        )
      }
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          choose(
            detail ?? `${label}：${String(value ?? "尚未产生")}。${from.note}`,
          );
        }
      }}
    >
      <title>{detail ?? `${label}：${String(value ?? "尚未产生")}`}</title>
      <rect width={w} height={64} rx={8} />
      <Label x={w / 2} y={20} anchor="middle" muted>
        {compact(label, 15)}
      </Label>
      <Label x={w / 2} y={49} anchor="middle" big>
        {compact(value, 11)}
      </Label>
    </g>
  );
  let drawing: ReactNode;
  const wire = (
    a: Point,
    b: Point,
    opts: {
      label?: string;
      active?: boolean;
      token?: unknown;
      bend?: number;
    } = {},
  ) => <Wire a={a} b={b} p={p} id={id} {...opts} />;
  if (spec.kind === "output") {
    const line = scene.code.split("\n")[from.line - 1] ?? "",
      oldLines = from.output.trimEnd().split("\n").filter(Boolean),
      incoming = to.output.slice(from.output.length).replace(/\n/g, "↵");
    drawing = (
      <>
        <Label x={22} y={28} muted>
          按执行顺序追加，已经写入的内容保留
        </Label>
        <Card
          x={22}
          y={60}
          w={200}
          h={105}
          title={`${from.phase} · 第${from.line}行`}
          value={from.line === 2 ? '"world" + 换行' : "第一段文字 + 换行"}
          active
        />
        <rect
          className="viz-terminal"
          x={300}
          y={50}
          width={195}
          height={190}
          rx={12}
        />
        <Label x={318} y={79} muted>
          标准输出缓冲区
        </Label>
        {oldLines.map((l, i) => (
          <g key={i}>
            <Label x={318} y={115 + i * 38}>
              {compact(l, 17)}
            </Label>
            <Label x={478} y={115 + i * 38} muted anchor="end">
              ↵
            </Label>
          </g>
        ))}
        {!oldLines.length && (
          <Label x={318} y={120} muted>
            等待写入
          </Label>
        )}
        {wire(
          { x: 224, y: 120 },
          { x: 296, y: 120 },
          {
            active: !!incoming,
            label: "字符流",
            token: incoming ? incoming.replace("↵", "") : undefined,
          },
        )}
        <Label x={22} y={276} muted>
          语句顺序 ① 第1行 → ② 第2行
        </Label>
      </>
    );
  } else if (spec.kind === "assignment") {
    const current = from.values.answer,
      initial = current === "尚未初始化" || current === undefined,
      source =
        to.values["右值"] ?? to.values.answer ?? values["右值"] ?? current;
    drawing = (
      <>
        <Label x={22} y={28} muted>
          {lesson.language === "python"
            ? "名字与值的绑定关系"
            : "先得到右侧，再写入左侧"}
        </Label>
        <Card
          x={22}
          y={73}
          w={170}
          h={96}
          title="右侧求值"
          value={source}
          active={changed}
        />
        <Card
          x={310}
          y={73}
          w={188}
          h={96}
          title={
            lesson.language === "python" ? "名字 answer" : "answer · 整数对象"
          }
          value={initial ? "尚未赋值" : current}
          active={!initial}
          ghost={initial}
        />
        {wire(
          { x: 194, y: 120 },
          { x: 306, y: 120 },
          {
            label: lesson.language === "python" ? "绑定" : "写入",
            active: to.values.answer !== from.values.answer,
            token: source,
          },
        )}
        <path className="viz-guide" d="M405 170 V218 H113" />
        <Label x={22} y={242} muted>
          {initial
            ? "先完成赋值，再读取变量"
            : `当前读取 answer → ${String(current)}`}
        </Label>
        <Label x={22} y={277}>
          {from.change ??
            (from.output ? "输出读取当前值" : "赋值完成后，旧值被新值替换")}
        </Label>
      </>
    );
  } else if (spec.kind === "division") {
    const n = Number(values.n ?? scene.steps[0].values.n),
      groups = Math.floor(n / 60),
      rest = n % 60;
    drawing = (
      <>
        <Label x={22} y={30} muted>
          总量 n = {n} 秒
        </Label>
        <rect
          x={22}
          y={65}
          width={476}
          height={62}
          rx={9}
          className="viz-track"
        />
        {[0, 1].map((i) => (
          <g key={i}>
            <rect
              x={22 + ((i * 60) / n) * 476}
              y={67}
              width={(60 / n) * 476 - 2}
              height={58}
              rx={7}
              className={index >= 1 ? "viz-fill" : "viz-outline"}
            />
            <Label
              x={22 + (((i + 0.5) * 60) / n) * 476}
              y={105}
              anchor="middle"
            >
              60 秒
            </Label>
          </g>
        ))}
        <rect
          x={22 + ((groups * 60) / n) * 476}
          y={67}
          width={(rest / n) * 476 - 2}
          height={58}
          rx={6}
          className={index >= 2 ? "viz-remainder" : "viz-outline"}
        />
        <Label
          x={22 + ((groups * 60 + rest / 2) / n) * 476}
          y={106}
          anchor="middle"
        >
          {rest}
        </Label>
        <path
          d={`M22 143 V153 H${22 + ((groups * 60) / n) * 476 - 2} V143`}
          className="viz-bracket"
        />
        <Label x={22 + (((groups * 60) / n) * 476) / 2} y={185} anchor="middle">
          {groups} 个完整分组
        </Label>
        <Card
          x={22}
          y={216}
          w={215}
          h={72}
          title={lesson.language === "python" ? "整除 n // 60" : "整除 n / 60"}
          value={index >= 1 ? values["整分钟"] : "等待求商"}
          active={index === 1}
        />
        <Card
          x={282}
          y={216}
          w={216}
          h={72}
          title="取余 n % 60"
          value={index >= 2 ? values["余秒"] : "等待取余"}
          active={index >= 2}
        />
      </>
    );
  } else if (spec.kind === "branch") {
    const condition = scene.code.match(/age\s*(>=|>)\s*(\d+)/),
      age = Number(values.age),
      limit = Number(condition?.[2] ?? 18),
      truth = from.branch;
    const axisMin = Math.min(0, age - 3),
      axisMax = Math.max(24, age + 3, limit + 3),
      axisX = (n: number) => 30 + ((n - axisMin) / (axisMax - axisMin)) * 460;
    drawing = (
      <>
        <Label x={22} y={28} muted>
          输入 age = {age}；判断 {condition?.[0]}
        </Label>
        <path d="M30 77 H490" className="viz-axis" />
        <rect
          x={axisX(limit)}
          y={61}
          width={Math.max(0, 490 - axisX(limit))}
          height={32}
          rx={4}
          className="viz-range"
        />
        <circle
          cx={axisX(limit)}
          cy={77}
          r={5}
          className={
            condition?.[1] === ">" ? "viz-open-point" : "viz-solid-point"
          }
        />
        <Label x={axisX(limit)} y={117} anchor="middle" muted>
          {limit} · 边界
        </Label>
        <path d={`M${axisX(age)} 39 V62`} className="viz-current" />
        <Label x={axisX(age)} y={29} anchor="middle">
          {age}
        </Label>
        <path
          d="M114 150 L175 192 L114 234 L53 192 Z"
          className="viz-diamond"
        />
        <Label x={114} y={188} anchor="middle">
          条件
        </Label>
        <Label x={114} y={210} anchor="middle">
          {truth === undefined ? "待判断" : truth ? "真" : "假"}
        </Label>
        {wire(
          { x: 175, y: 178 },
          { x: 318, y: 160 },
          { label: "真", active: truth === true, bend: -22 },
        )}
        {wire(
          { x: 175, y: 206 },
          { x: 318, y: 252 },
          { label: "假", active: truth === false, bend: 20 },
        )}
        <Card
          x={324}
          y={127}
          w={174}
          h={69}
          title="if 分支"
          value="adult"
          active={truth === true}
          ghost={truth !== true}
        />
        <Card
          x={324}
          y={219}
          w={174}
          h={69}
          title="else 分支"
          value="minor"
          active={truth === false}
          ghost={truth !== false}
        />
      </>
    );
  } else if (spec.kind === "loop") {
    const isWhile = lesson.topic === "while",
      bound = isWhile
        ? Number(scene.code.match(/i\s*<=\s*(\d+)/)?.[1] ?? 3)
        : lesson.language === "python"
          ? Number(scene.code.match(/range\(1,\s*(\d+)/)?.[1] ?? 5)
          : Number(scene.code.match(/i\s*<=?\s*(\d+)/)?.[1] ?? 5),
      inclusive = isWhile || /i <=/.test(scene.code),
      end = inclusive ? bound : bound - 1,
      slots = Math.max(1, inclusive ? bound + 1 : bound),
      cw = Math.min(76, 464 / slots),
      sx = 260 - (slots * cw) / 2;
    const additions = history.filter(
      (s, i) =>
        i > 0 &&
        typeof s.values.total === "number" &&
        Number(s.values.total) > Number(history[i - 1].values.total ?? 0),
    );
    const processed = additions.map((s) => Number(s.values.i)),
      i = from.values.i,
      nowTotal = values.total ?? 0,
      previousTotal = from.values.total ?? 0,
      nextTotal = to.values.total ?? previousTotal,
      adding = nextTotal !== previousTotal;
    const updating =
      typeof i === "number" &&
      typeof to.values.i === "number" &&
      i !== to.values.i;
    const returning = !!i && !adding && (updating || to.phase === "循环结束");
    const cursorI = updating
      ? Number(i) + (Number(to.values.i) - Number(i)) * ease(p)
      : Number(i);
    const returnDot = routePoint(
      [
        { x: 350, y: 224 },
        { x: 481, y: 224 },
        { x: 481, y: 161 },
        { x: 80, y: 161 },
        { x: 80, y: 181 },
      ],
      p,
    );
    drawing = (
      <>
        <Label x={22} y={27} muted>
          {isWhile
            ? `i ≤ ${bound}：每轮结束必须推进i`
            : `参与范围 1…${end}；${inclusive ? "包含" : "排除"}右边界 ${bound}`}
        </Label>
        {Array.from({ length: slots }, (_, j) =>
          cell(
            j + 1,
            sx + j * cw,
            48,
            cw - 5,
            processed.includes(j + 1)
              ? "已累加"
              : j + 1 > end
                ? "不进入"
                : "待访问",
            Number(i) === j + 1,
            j + 1 > end,
            `${j + 1}${j + 1 > end ? "不在本次循环范围内，不会参与累加。" : processed.includes(j + 1) ? "已经进入过累加器。" : "尚未被累加。"}`,
          ),
        )}
        {i !== undefined && (
          <g
            transform={`translate(${sx + (Math.min(slots, cursorI) - 1) * cw + cw / 2 - 2} 124)`}
          >
            <path d="M-6 7 L0 0 L6 7" className="viz-current" />
            <Label x={0} y={30} anchor="middle">
              {updating && p > 0 ? `i: ${i} → ${to.values.i}` : `i = ${i}`}
            </Label>
          </g>
        )}
        <Card
          x={22}
          y={185}
          w={125}
          h={80}
          title="条件 / 取值"
          value={
            from.phase === "循环结束" ||
            from.phase === "遍历结束" ||
            (atEnd && !!from.output)
              ? "结束"
              : i === undefined
                ? "准备"
                : `i = ${i}`
          }
          active={from.line === 2}
        />
        <Card
          x={207}
          y={185}
          w={143}
          h={80}
          title="累加器 total"
          value={nowTotal}
          active={adding || from.line === 3}
        />
        {wire(
          { x: 150, y: 222 },
          { x: 202, y: 222 },
          {
            active: adding,
            token: adding
              ? Number(nextTotal) - Number(previousTotal)
              : undefined,
          },
        )}
        <path
          d="M350 224 H481 V161 H80 V181"
          className={`viz-return ${!atEnd ? "active" : ""}`}
          markerEnd={`url(#${id})`}
        />
        {returning && p > 0 && (
          <circle
            cx={returnDot.x}
            cy={returnDot.y}
            r={6}
            fill="#2868dc"
            stroke="#bedbff"
            strokeWidth={4}
          />
        )}
        <Label x={477} y={252} anchor="end" muted>
          推进 → 回到判断
        </Label>
        <g aria-label={"累加量的组成，已完成" + additions.length + "轮"}>
          <rect
            x={207}
            y={272}
            width={291}
            height={9}
            rx={4}
            className="viz-track"
          />
          {additions.map((s, k) => {
            let before = additions
                .slice(0, k)
                .reduce((sum, a) => sum + Number(a.values.i), 0),
              max = Math.max(1, (end * (end + 1)) / 2);
            return (
              <rect
                key={k}
                x={207 + (before / max) * 291}
                y={272}
                width={(Number(s.values.i) / max) * 291}
                height={9}
                rx={2}
                fill={["#2e64de", "#438ce8", "#34a7d2", "#729bfa"][k % 4]}
              >
                <title>{String(s.values.i) + "进入累加器"}</title>
              </rect>
            );
          })}
          {adding && p > 0 && (
            <rect
              x={
                207 +
                (Number(previousTotal) / Math.max(1, (end * (end + 1)) / 2)) *
                  291
              }
              y={272}
              width={
                ((Number(nextTotal) - Number(previousTotal)) /
                  Math.max(1, (end * (end + 1)) / 2)) *
                291 *
                ease(p)
              }
              height={9}
              rx={2}
              fill="#9cc7f6"
            >
              <title>{`本轮将加入${Number(nextTotal) - Number(previousTotal)}`}</title>
            </rect>
          )}
        </g>
        {adding && (
          <Label x={260} y={299} anchor="middle">
            {p > 0 ? "正在传入" : "下一步加入"}{" "}
            {Number(nextTotal) - Number(previousTotal)}：{previousTotal} +{" "}
            {Number(nextTotal) - Number(previousTotal)} → {nextTotal}
          </Label>
        )}
        {!adding && (
          <Label x={22} y={299} muted>
            {from.output
              ? `循环结束后才输出 ${from.output.trim()}`
              : `已完成 ${additions.length} 次累加；total = ${nowTotal}`}
          </Label>
        )}
      </>
    );
  } else if (
    ["array", "offset", "append", "cstring", "slice"].includes(spec.kind)
  ) {
    const max = Math.max(1, allItems.length),
      cw = Math.min(84, 464 / max),
      sx = 260 - (max * cw) / 2,
      original = allItems,
      current = spec.kind === "slice" ? original : items,
      selected = from.active;
    const slice = spec.kind === "slice",
      cstring = spec.kind === "cstring",
      offset = spec.kind === "offset",
      append = spec.kind === "append",
      array = spec.kind === "array";
    const allowed = array
      ? new Set(
          scene.steps.flatMap((s) =>
            s.active === undefined ? [] : [s.active],
          ),
        )
      : new Set(original.map((_, i) => i));
    const sourceLabel = slice
      ? "text · 原字符串保持不变"
      : cstring
        ? "word · 含结束符的存储位置"
        : offset
          ? "numbers · 按元素偏移"
          : append
            ? lesson.id === "cpp-9"
              ? "word · 字符序列"
              : "values · 逻辑元素序列"
            : lesson.id === "c-18"
              ? "students · 每个对象的score"
              : "numbers · 原始数据";
    drawing = (
      <>
        <Label x={22} y={29} muted>
          {sourceLabel}
        </Label>
        {original.map((v, j) =>
          cell(
            current[j] ?? (append ? "待追加" : v),
            sx + j * cw,
            53,
            cw - 6,
            `[${j}]`,
            selected === j ||
              (array && state.visited.includes(j)) ||
              (slice && index > 0 && j < 2),
            (array && !allowed.has(j)) || (append && current[j] === undefined),
            `${sourceLabel}，下标${j}；${cstring && v === "\\0" ? "结束符占位但不计入strlen。" : slice ? "原字符串在切片后依然保留这个字符。" : array && !allowed.has(j) ? "此元素不在本次遍历范围中。" : `值为${String(current[j] ?? v)}。`}`,
          ),
        )}
        {cstring ? (
          <>
            {(index > 0 || p > 0) && (
              <g
                transform={`translate(${sx + ((from.active ?? (index === 0 ? 0 : 3)) + ((to.active ?? from.active ?? 3) - (from.active ?? (index === 0 ? 0 : 3))) * ease(p) + 0.5) * cw - 3} 49)`}
              >
                <path d="M-6 -6 L0 0 L6 -6" className="viz-current" />
              </g>
            )}
            <path
              d={`M${sx} 134 V146 H${sx + 3 * cw - 6} V134`}
              className="viz-bracket"
            />
            <Label x={sx + 1.5 * cw} y={175} anchor="middle">
              计数 3 个字符
            </Label>
            <path d={`M${sx + 3.5 * cw} 121 V174`} className="viz-stop" />
            <Label x={sx + 3.5 * cw} y={198} anchor="middle">
              遇到 \0 停止
            </Label>
            <Card
              x={155}
              y={224}
              w={210}
              h={68}
              title="strlen(word)"
              value={values.length ?? "等待计数"}
              active={index > 0}
            />
          </>
        ) : slice ? (
          <>
            <path
              d={`M${sx} 130 V141 H${sx + 2 * cw - 6} V130`}
              className="viz-bracket"
            />
            <Label x={sx + cw} y={170} anchor="middle">
              选区 [0, 2)
            </Label>
            {wire(
              { x: 160, y: 177 },
              { x: 260, y: 215 },
              {
                active: index === 0,
                label: "生成新字符串",
                token: index === 0 && p > 0 ? "py" : undefined,
              },
            )}
            {cell(
              index > 0 ? "py" : "尚未产生",
              171,
              223,
              178,
              "prefix",
              index > 0,
              false,
              "prefix是新的字符串；text仍是python。",
            )}
          </>
        ) : offset ? (
          <>
            <path
              d={`M${sx + cw / 2} 134 V155 H${sx + 2.5 * cw} V132`}
              className="viz-bracket"
            />
            <Label x={260} y={189} anchor="middle">
              p + 2：跨过两个元素
            </Label>
            <Card
              x={22}
              y={220}
              w={190}
              h={72}
              title="p 的指向"
              value={index >= 1 ? "numbers[0]" : "等待绑定"}
            />
            {wire(
              { x: 216, y: 257 },
              { x: 310, y: 257 },
              {
                label: "解引用",
                active: index >= 2,
                token: index >= 2 ? values.result : undefined,
              },
            )}
            <Card
              x={316}
              y={220}
              w={182}
              h={72}
              title="*(p + 2)"
              value={values.result ?? "尚未读取"}
              active={index >= 2}
            />
          </>
        ) : append ? (
          <>
            {lesson.id === "cpp-10" && from.values.value !== undefined ? (
              <>
                <Label x={330} y={158} muted>
                  size = {items.length}
                </Label>
                <Label x={245} y={230} muted>
                  value = {from.values.value}
                </Label>
                {selected !== undefined &&
                  wire(
                    { x: sx + (selected + 0.5) * cw - 3, y: 121 },
                    { x: 120, y: 210 },
                    {
                      active: true,
                      token:
                        to.values.total !== from.values.total
                          ? from.values.value
                          : undefined,
                    },
                  )}
              </>
            ) : (
              <Label x={22} y={158} muted>
                size = {items.length}；保留已有元素，末尾追加
              </Label>
            )}
            {wire(
              { x: 440, y: 191 },
              { x: sx + (max - 0.5) * cw, y: 121 },
              {
                active: index === 0,
                label: lesson.id === "cpp-9" ? '追加 "s"' : "push_back(6)",
                token: to.items?.[max - 1],
              },
            )}
            <Card
              x={22}
              y={216}
              w={196}
              h={76}
              title={lesson.id === "cpp-9" ? "当前字符数" : "遍历累加结果"}
              value={
                lesson.id === "cpp-9"
                  ? (values.size ?? items.length)
                  : (values.total ?? "等待遍历")
              }
              active={changed}
            />
            <Label x={245} y={270} muted>
              {lesson.id === "cpp-9"
                ? "原来的cat没有消失"
                : "size是当前逻辑元素数"}
            </Label>
          </>
        ) : (
          <>
            {selected !== undefined &&
              wire(
                { x: sx + (selected + 0.5) * cw - 3, y: 121 },
                { x: 260, y: 205 },
                {
                  label: lesson.id === "c-18" ? "读取 score" : "取值并累加",
                  active:
                    to.values.total !== undefined &&
                    to.values.total !== from.values.total,
                  token:
                    to.values.total !== from.values.total
                      ? original[selected]
                      : undefined,
                },
              )}
            <Card
              x={155}
              y={220}
              w={210}
              h={72}
              title="total · 已累加的和"
              value={values.total ?? "尚未初始化"}
              active={changed}
            />
            {array && allowed.size < original.length && (
              <Label x={22} y={178} muted>
                虚线位置仍有数据，但未进入遍历范围
              </Label>
            )}
          </>
        )}
      </>
    );
  } else if (spec.kind === "call" || spec.kind === "scope") {
    const scope = spec.kind === "scope",
      arg = scope
        ? scene.steps[0].values["main.n"]
        : (values["实参"] ?? scene.steps[0].values["实参"]),
      live = scope ? index === 1 : !!from.frame,
      result = scope ? values.result : (from.returned ?? values["返回值"]);
    drawing = (
      <>
        <Label x={22} y={28} muted>
          {scope
            ? "副本的修改与调用方写回分开表示"
            : "一次调用拥有自己的局部帧"}
        </Label>
        <rect
          x={22}
          y={54}
          width={180}
          height={201}
          rx={12}
          className="viz-scope"
        />
        <Label x={38} y={82}>
          调用方
        </Label>
        <Card
          x={38}
          y={104}
          w={148}
          h={88}
          title={
            scope
              ? "main.n"
              : result !== undefined
                ? "调用表达式的值"
                : "square(实参)"
          }
          value={scope ? values["main.n"] : (result ?? arg)}
          active={scope && index === 2}
        />
        <rect
          x={300}
          y={54}
          width={198}
          height={201}
          rx={12}
          className={live ? "viz-scope active" : "viz-scope ghost"}
        />
        <Label x={316} y={82}>
          {scope ? "add_one 局部帧" : "square 局部帧"}
        </Label>
        <Card
          x={316}
          y={104}
          w={166}
          h={88}
          title={
            live
              ? scope
                ? "形参副本"
                : "n"
              : index > 1
                ? "调用已结束"
                : "等待调用"
          }
          value={live ? (scope ? values["形参副本"] : from.values.n) : "—"}
          active={live}
        />
        {wire(
          { x: 204, y: 113 },
          { x: 296, y: 113 },
          { label: scope ? "复制值" : "传参", active: index === 0, token: arg },
        )}
        {wire(
          { x: 298, y: 220 },
          { x: 205, y: 220 },
          {
            label: result !== undefined ? "return " + result : "return",
            active: result !== undefined,
            token: result,
          },
        )}
        <Label x={22} y={287}>
          {scope
            ? index >= 2
              ? `显式写回：n ← ${values["main.n"]}`
              : "返回值还不会自动改写 main.n"
            : result !== undefined
              ? `调用表达式取得 ${result}；然后才输出`
              : "沿箭头观察参数进入与返回值离开"}
        </Label>
      </>
    );
  } else if (spec.kind === "character") {
    const ch = String(values.ch ?? "'7'").replaceAll("'", ""),
      digit = /^[0-9]$/.test(ch),
      start = 30,
      cw = 46;
    drawing = (
      <>
        <Label x={22} y={28} muted>
          字符区间比较，不是把字符当作整数7
        </Label>
        {Array.from({ length: 10 }, (_, i) =>
          cell(
            String(i),
            start + i * cw,
            58,
            cw - 4,
            `'${i}'`,
            ch === String(i),
            false,
            `字符 '${i}' 位于数字字符区间。`,
          ),
        )}
        <path d="M30 136 V148 H486 V136" className="viz-bracket" />
        <Label x={260} y={180} anchor="middle">
          '0' ≤ '{ch}' ≤ '9'
        </Label>
        <Card
          x={22}
          y={210}
          w={185}
          h={76}
          title="下界比较 / 上界比较"
          value={index > 0 ? "真  &&  真" : "等待比较"}
          active={index === 1}
        />
        {wire(
          { x: 211, y: 248 },
          { x: 318, y: 248 },
          { label: "逻辑与", active: index === 0, token: to.values.is_digit },
        )}
        <Card
          x={324}
          y={210}
          w={174}
          h={76}
          title="is_digit"
          value={index > 0 ? Number(digit) : "—"}
          active={index > 0}
        />
      </>
    );
  } else if (spec.kind === "matrix") {
    const first = scene.steps[0].values,
      selected = index >= 1;
    drawing = (
      <>
        <Label x={22} y={28} muted>
          先定位行，再定位列；蓝色格子位于主对角线
        </Label>
        <Label x={135} y={59} anchor="middle" muted>
          列0
        </Label>
        <Label x={233} y={59} anchor="middle" muted>
          列1
        </Label>
        {[0, 1].map((r) => (
          <g key={r}>
            <Label x={31} y={107 + r * 85} muted>
              行{r}
            </Label>
            {[0, 1].map((c) =>
              cell(
                first[`[${r}][${c}]`],
                86 + c * 98,
                76 + r * 85,
                86,
                `[${r}][${c}]`,
                selected && r === c,
                false,
                `grid[${r}][${c}]：第${r}行、第${c}列，值${first[`[${r}][${c}]`]}。${r === c ? "位于主对角线。" : "不在本次求和中。"}`,
              ),
            )}
          </g>
        ))}
        {wire(
          { x: 278, y: 126 },
          { x: 346, y: 126 },
          { active: selected, label: "读取" },
        )}
        <Card
          x={350}
          y={93}
          w={148}
          h={127}
          title="对角线求和"
          value={selected ? "1 + 4 = 5" : "等待取值"}
          active={selected}
        />
        <Label x={86} y={285} muted>
          4个单元格分别保存自己的值
        </Label>
      </>
    );
  } else if (spec.kind === "unpack") {
    const original = scene.steps[0].values,
      swap = index > 0;
    drawing = (
      <>
        <Label x={22} y={28} muted>
          先保存右侧快照，再重新绑定左侧
        </Label>
        <Card
          x={22}
          y={58}
          w={164}
          h={81}
          title="名字 x"
          value={values.x}
          active={swap}
        />
        <Card
          x={334}
          y={58}
          w={164}
          h={81}
          title="名字 y"
          value={values.y}
          active={swap}
        />
        <Card
          x={150}
          y={205}
          w={220}
          h={85}
          title={swap ? "本次右侧快照 (y, x)" : "下一句右侧 (y, x)"}
          value={`(${original.y}, ${original.x})`}
          active={index === 0}
        />
        {wire(
          { x: 193, y: 200 },
          { x: 106, y: 143 },
          {
            label: `右侧第1项 ${original.y}`,
            active: index === 0,
            token: original.y,
            bend: -30,
          },
        )}
        {wire(
          { x: 329, y: 200 },
          { x: 412, y: 143 },
          {
            label: `右侧第2项 ${original.x}`,
            active: index === 0,
            token: original.x,
            bend: 30,
          },
        )}
      </>
    );
  } else if (spec.kind === "dictionary") {
    const entries = Object.entries(scene.steps[0].values),
      name = values.name,
      found = entries.find(([k]) => k === name);
    drawing = (
      <>
        <Label x={22} y={28} muted>
          从键查到值，匹配的位置连成一条路径
        </Label>
        <Card
          x={22}
          y={91}
          w={160}
          h={90}
          title="查询键 name"
          value={name ?? "等待输入"}
          active={name !== undefined}
        />
        {entries.map(([k, v], j) => (
          <g key={k}>
            {cell(k, 288, 57 + j * 91, 116, "键", k === name)}
            {cell(v, 420, 57 + j * 91, 78, "值", k === name)}
          </g>
        ))}
        {name &&
          wire(
            { x: 186, y: 136 },
            { x: 284, y: 89 + entries.findIndex(([k]) => k === name) * 91 },
            { label: "匹配", active: !!found, token: name },
          )}
        <Label x={22} y={265}>
          {values.price === undefined
            ? "get(name, 0)：缺失时才使用默认值0"
            : `匹配结果 → price = ${values.price}`}
        </Label>
      </>
    );
  } else if (spec.kind === "set") {
    const input = scene.steps[0].items ?? [],
      unique = [...new Set(input)],
      done = index > 0;
    drawing = (
      <>
        <Label x={22} y={28} muted>
          输入列表保留重复；集合把相同值合流
        </Label>
        {input.map((v, i) =>
          cell(v, 54 + i * 142, 53, 118, `输入[${i}]`, false),
        )}
        <rect
          x={60}
          y={216}
          width={400}
          height={80}
          rx={36}
          className="viz-set"
        />
        {unique.map((v, i) => (
          <g key={String(v)}>
            <circle
              cx={172 + i * 176}
              cy={254}
              r={27}
              className={done ? "viz-fill" : "viz-outline"}
            />
            <Label x={172 + i * 176} y={261} anchor="middle" big>
              {done ? String(v) : "?"}
            </Label>
          </g>
        ))}
        {input.map((v, i) => (
          <Wire
            key={i}
            a={{ x: 113 + i * 142, y: 120 }}
            b={{ x: 172 + unique.indexOf(v) * 176, y: 223 }}
            p={index === 0 ? p : 0}
            active
            id={id}
            token={v}
          />
        ))}
        <Label x={260} y={194} anchor="middle" muted>
          {done ? `不同值数量 = ${unique.length}` : "同值指向同一个集合元素"}
        </Label>
      </>
    );
  } else if (spec.kind === "filter") {
    const input = scene.steps[0].items ?? [],
      n = from.values.n,
      current = n === undefined ? -1 : input.indexOf(n),
      result = values["新列表"] ?? (atEnd ? "[9,16]" : "[]"),
      passed = typeof n === "number" && n > 0;
    drawing = (
      <>
        <Label x={22} y={28} muted>
          先判断，再计算；失败的元素不会进入结果
        </Label>
        {input.map((v, i) =>
          cell(
            v,
            22 + i * 87,
            51,
            77,
            `输入[${i}]`,
            i === current,
            Number(v) <= 0 && index > 0,
          ),
        )}
        {current >= 0 &&
          wire(
            { x: 22 + current * 87 + 38.5, y: 119 },
            { x: 90, y: 160 },
            { active: true, token: n },
          )}
        {n !== undefined && !passed && (
          <g>
            <path
              d="M90 254 V278 M82 271 L98 287 M98 271 L82 287"
              className="viz-error-path"
            />
            <Label x={112} y={283} muted>
              跳过
            </Label>
          </g>
        )}
        <path d="M90 165 L152 209 L90 253 L28 209 Z" className="viz-diamond" />
        <Label x={90} y={204} anchor="middle">
          n &gt; 0
        </Label>
        <Label x={90} y={228} anchor="middle">
          {atEnd
            ? "筛选完成"
            : n === undefined
              ? "待判断"
              : passed
                ? "通过"
                : "不通过"}
        </Label>
        {wire(
          { x: 156, y: 209 },
          { x: 247, y: 209 },
          { label: "通过", active: passed, token: n },
        )}
        <Card
          x={251}
          y={171}
          w={112}
          h={78}
          title="再计算"
          value="n × n"
          active={passed}
        />
        {wire(
          { x: 365, y: 209 },
          { x: 414, y: 209 },
          {
            active: passed,
            token: typeof n === "number" && n > 0 ? n * n : undefined,
          },
        )}
        <Card
          x={419}
          y={171}
          w={79}
          h={78}
          title="追加"
          value={atEnd ? "完成" : passed ? Number(n) * Number(n) : "—"}
          active={passed}
        />
        <Label x={287} y={94} muted>
          新列表
        </Label>
        <Label x={287} y={125} big>
          {String(result)}
        </Label>
        <Label x={22} y={292} muted>
          {atEnd
            ? "sum([9,16]) = 25"
            : n !== undefined && !passed
              ? `${n} 被筛掉：不执行平方，不追加`
              : "沿数据路径观察筛选顺序"}
        </Label>
      </>
    );
  } else if (spec.kind === "exception") {
    const failed = index >= 1;
    drawing = (
      <>
        <Label x={22} y={28} muted>
          转换失败，跳转处理；赋值没有完成
        </Label>
        <Card x={22} y={63} w={146} h={83} title="text" value={'"abc"'} />
        {wire(
          { x: 172, y: 105 },
          { x: 249, y: 105 },
          { label: "int(text)", active: index === 0, token: "abc" },
        )}
        <Card
          x={255}
          y={63}
          w={243}
          h={83}
          title="尝试转换"
          value={failed ? "ValueError" : 'int("abc")'}
          active={failed}
        />
        <path
          d="M376 149 V187 H161 V210"
          className={failed ? "viz-error-path" : "viz-guide"}
        />
        <Label x={250} y={179} anchor="middle">
          except ValueError
        </Label>
        <Card
          x={22}
          y={217}
          w={267}
          h={73}
          title="匹配的异常处理"
          value={
            from.output ? "输出 invalid" : failed ? "处理输入错误" : "等待异常"
          }
          active={index >= 2}
        />
        <Card
          x={322}
          y={217}
          w={176}
          h={73}
          title="value · 赋值未完成"
          value="没有新绑定"
          ghost
        />
      </>
    );
  } else if (spec.kind === "encapsulation") {
    const amount = values.amount,
      accepted = Number(amount) > 0;
    drawing = (
      <>
        <Label x={22} y={28} muted>
          公开入口验证参数，内部余额只接受合法修改
        </Label>
        <Card
          x={22}
          y={72}
          w={127}
          h={88}
          title="deposit参数"
          value={amount ?? "待调用"}
          active={amount !== undefined}
        />
        <path
          d="M246 63 L305 115 L246 167 L187 115 Z"
          className={
            amount !== undefined && !accepted
              ? "viz-diamond rejected"
              : "viz-diamond"
          }
        />
        <Label x={246} y={110} anchor="middle">
          amount
        </Label>
        <Label x={246} y={135} anchor="middle">
          &gt; 0 ?
        </Label>
        {wire(
          { x: 152, y: 116 },
          { x: 181, y: 116 },
          { active: amount !== undefined },
        )}
        {wire(
          { x: 309, y: 116 },
          { x: 345, y: 116 },
          { active: accepted, token: amount },
        )}
        <Card
          x={350}
          y={69}
          w={148}
          h={94}
          title="private balance"
          value={values.balance ?? links[0]?.fields.balance}
          active={accepted}
        />
        <Label x={22} y={220}>
          {amount === undefined
            ? "规则：仅接受正数"
            : accepted
              ? `${amount} 通过验证，写入内部余额`
              : `${amount} 被拒绝，余额保持不变`}
        </Label>
        <path d="M350 179 H498" className="viz-bracket" />
        <Label x={350} y={210} muted>
          外部通过get()读取
        </Label>
        <Label x={22} y={279} muted>
          封装的作用：让合法操作成为唯一修改入口
        </Label>
      </>
    );
  } else if (spec.kind === "composition") {
    const fields = links[0]?.fields ?? {
      x: values["position.x"] ?? 0,
      y: values["position.y"] ?? 0,
    };
    drawing = (
      <>
        <Label x={22} y={28} muted>
          访问路径：player → position → x
        </Label>
        <rect
          x={22}
          y={51}
          width={476}
          height={243}
          rx={14}
          className="viz-scope"
        />
        <Label x={40} y={82}>
          Player · player
        </Label>
        <rect
          x={186}
          y={98}
          width={288}
          height={171}
          rx={11}
          className="viz-nested"
        />
        <Label x={204} y={128}>
          Position · position
        </Label>
        {cell(fields.x, 204, 154, 118, "x", index === 1)}
        {cell(fields.y, 336, 154, 118, "y")}
        <Label x={40} y={182}>
          move(3)
        </Label>
        {wire(
          { x: 114, y: 191 },
          { x: 200, y: 191 },
          { active: index === 0 || index === 1, token: 3 },
        )}
        <Label x={204} y={249} muted>
          x改变，y保留
        </Label>
      </>
    );
  } else {
    const distinct = spec.kind === "copy" || spec.kind === "instances",
      construct = spec.kind === "constructor",
      record = spec.kind === "record";
    const rows = Math.max(1, ...scene.steps.map((s) => s.links?.length ?? 0));
    // Stable row identity expresses the authored objects even when a method becomes
    // the access label. No made-up memory addresses or extra heap allocations.
    drawing = (
      <>
        <Label x={22} y={27} muted>
          {distinct
            ? "独立的对象边界，独立的成员状态"
            : construct
              ? "本次参数进入新对象的初始化过程"
              : record
                ? "沿访问入口找到对象，再选择成员"
                : "多个访问入口连接同一个对象"}
        </Label>
        {Array.from({ length: rows }, (_, r) => {
          const link = links[r],
            prototype = scene.steps.find((s) => s.links?.[r])?.links?.[r],
            template =
              record &&
              from.values["类型"] !== undefined &&
              /定义|类型描述|还没有/.test(from.note),
            freshInstance = lesson.id === "python-16" && index === 0,
            fields =
              link?.fields ??
              (template
                ? Object.fromEntries(
                    Object.keys(prototype?.fields ?? {}).map((k) => [k, "—"]),
                  )
                : r === 0
                  ? Object.fromEntries(
                      Object.entries(from.values).filter(
                        ([k]) => !["类型", "规则", "start"].includes(k),
                      ),
                    )
                  : {}),
            names =
              lesson.id === "cpp-11" && link
                ? ["value", "ref"]
                : (link?.from ?? prototype?.from ?? "等待创建")
                    .split("/")
                    .map((n) => n.trim()),
            y = rows > 1 ? 55 + r * 119 : 77,
            fieldEntries = Object.entries(fields),
            exists =
              !!link || freshInstance || (!template && fieldEntries.length > 0),
            nextFields =
              lessonVisualState(
                scene,
                Math.min(index + 1, scene.steps.length - 1),
              ).links[r]?.fields ?? {};
          return (
            <g key={r}>
              <Card
                x={22}
                y={y + 13}
                w={149}
                h={rows > 1 ? 75 : 117}
                title={
                  template
                    ? "类型模板"
                    : freshInstance
                      ? "实例名字"
                      : link
                        ? "访问入口"
                        : construct
                          ? "初始化参数"
                          : "名字 / 类型"
                }
                value={
                  template
                    ? from.values["类型"]
                    : freshInstance
                      ? "counter"
                      : construct && !link
                        ? (values.start ?? "等待传入")
                        : link
                          ? names[0]
                          : "尚未建立关系"
                }
                active={!!link || template || freshInstance}
                ghost={!link && !template && !freshInstance}
              />
              {names.length > 1 && (
                <Label x={37} y={y + (rows > 1 ? 78 : 111)} muted>
                  {compact(names.slice(1).join(" / "), 16)}
                </Label>
              )}
              {wire(
                { x: 175, y: y + 51 },
                { x: 281, y: y + 51 },
                {
                  label: compact(
                    link?.label ?? (construct ? "初始化" : "建立关系"),
                    6,
                  ),
                  active: !!link || (construct && !!to.links?.length),
                  token: construct
                    ? values.start
                    : Object.entries(nextFields).find(
                        ([k, v]) => fields[k] !== v,
                      )?.[1],
                },
              )}
              <rect
                x={287}
                y={y}
                width={211}
                height={rows > 1 ? 105 : 164}
                rx={11}
                className={exists ? "viz-object" : "viz-object ghost"}
              />
              <Label x={302} y={y + 25}>
                {compact(
                  link?.to ??
                    (freshInstance
                      ? "Counter 实例"
                      : template
                        ? "实例尚未创建"
                        : exists
                          ? (prototype?.to ?? "现有对象")
                          : construct
                            ? "新实例 · 尚待初始化"
                            : "对象 · 待建立"),
                  18,
                )}
              </Label>
              {fieldEntries
                .slice(0, rows > 1 ? 2 : 3)
                .map(([key, value], j) => (
                  <g
                    key={key}
                    role="button"
                    tabIndex={0}
                    data-inspect={`${link?.to ?? "对象"}的${key}：${value}`}
                    className={
                      nextFields[key] !== undefined && nextFields[key] !== value
                        ? "viz-field will-change"
                        : "viz-field"
                    }
                  >
                    <rect
                      x={300}
                      y={y + 36 + j * (rows > 1 ? 27 : 35)}
                      width={185}
                      height={rows > 1 ? 25 : 32}
                      rx={5}
                    />
                    <Label x={310} y={y + 55 + j * (rows > 1 ? 27 : 35)} muted>
                      {compact(key, 13)}
                    </Label>
                    <Label
                      x={474}
                      y={y + 55 + j * (rows > 1 ? 27 : 35)}
                      anchor="end"
                    >
                      {compact(value, 12)}
                    </Label>
                  </g>
                ))}
              {!fieldEntries.length && (
                <Label x={302} y={y + 76} muted>
                  成员尚未建立
                </Label>
              )}
            </g>
          );
        })}
        {rows === 1 && (
          <Label x={22} y={282} muted>
            {construct
              ? "完成初始化后才能读取本次实例的属性"
              : lesson.id === "cpp-11"
                ? "ref是别名，这里没有第二个整数副本"
                : record
                  ? "成员分别保存；只修改代码指定的字段"
                  : "箭头表达访问关系，不是实际内存地址"}
          </Label>
        )}
      </>
    );
  }
  return (
    <div
      className={`teaching-canvas scene-motion-canvas ${compactView ? "compact" : ""}`}
      data-visual-kind={spec.kind}
      data-lesson={lesson.id}
      data-playhead={time.toFixed(4)}
      data-step={index}
    >
      <svg
        onClick={(event) => {
          const node = (event.target as Element).closest("[data-inspect]");
          if (node)
            choose(node.getAttribute("data-inspect") + "。" + from.note);
        }}
        onKeyDown={(event) => {
          if (event.defaultPrevented) return;
          if (event.key === "Enter" || event.key === " ") {
            const node = (event.target as Element).closest("[data-inspect]");
            if (node) {
              event.preventDefault();
              choose(node.getAttribute("data-inspect") + "。" + from.note);
            }
          }
        }}
        viewBox="0 0 520 316"
        role="group"
        aria-label={`${lesson.title}：${spec.question}`}
      >
        <defs>
          <marker
            id={id}
            markerWidth={7}
            markerHeight={7}
            refX={6}
            refY={3.5}
            orient="auto"
          >
            <path
              d="M1 1 L6 3.5 L1 6"
              fill="none"
              stroke="context-stroke"
              strokeWidth={1.4}
            />
          </marker>
          <pattern
            id={id + "-grid"}
            width={26}
            height={26}
            patternUnits="userSpaceOnUse"
          >
            <circle cx={1} cy={1} r={0.8} fill="#9caeca" opacity={0.32} />
          </pattern>
        </defs>
        <rect width={520} height={316} fill={`url(#${id}-grid)`} />
        {drawing}
      </svg>
      <div className="viz-reading" aria-live="off">
        {inspection || spec.legend}
      </div>
    </div>
  );
}
