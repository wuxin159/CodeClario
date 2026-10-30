import type { TraceStep, TraceValue, ExecutionTrace } from "./flow.ts";
// 地址只属于一次调试运行。缓存比较按对象别名关系归一化，原始记录与界面中的地址不改写。
export function stableTraceEvidence(trace?: ExecutionTrace) {
  if (trace?.provenance !== "native-debug-repeat") return trace;
  const labels = new Map<string, string>();
  const address = (v: string) => {
    if (v === "0x0") return "null";
    if (!labels.has(v)) labels.set(v, "object-" + (labels.size + 1));
    return labels.get(v)!;
  };
  const node = (n: TraceValue): TraceValue => {
    const addr = n.address ? address(n.address) : undefined,
      target = n.target ? address(n.target) : undefined;
    const children = n.children?.map(node);
    const value =
      n.kind === "pointer" || n.kind === "reference"
        ? n.value.replace(/0x[0-9a-f]+/gi, address)
        : children?.length && (n.kind === "array" || n.kind === "object")
          ? JSON.stringify(children.map((c) => [c.name, c.value]))
          : n.value;
    return {
      ...n,
      ...(addr ? { address: addr } : {}),
      ...(target ? { target } : {}),
      value,
      ...(children ? { children } : {}),
    };
  };
  const frame = (f: {
    values: Record<string, string>;
    data?: TraceValue[];
  }) => {
    const data = f.data?.map(node);
    return {
      ...f,
      ...(data ? { data } : {}),
      values: Object.fromEntries(
        Object.entries(f.values).map(([name, value]) => [
          name,
          data?.find((n) => n.name === name)?.value ?? value,
        ]),
      ),
    };
  };
  return {
    ...trace,
    steps: trace.steps.map((s) => ({
      ...s,
      ...frame(s),
      ...(s.returnTarget
        ? {
            returnTarget: address(s.returnTarget),
            returned: s.returned?.replace(/0x[0-9a-f]+/gi, address),
          }
        : {}),
      ...(s.frames
        ? { frames: s.frames.map((f) => ({ ...f, ...frame(f) })) }
        : {}),
    })),
  };
}
export function observedValues(step: TraceStep): TraceValue[] {
  return (
    step.data ??
    Object.entries(step.values).map(([name, value]) => {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed))
          return {
            name,
            type: "序列",
            value,
            kind: "array" as const,
            size: parsed.length,
            children: parsed.slice(0, 12).map((v, i) => ({
              name: "[" + i + "]",
              type: typeof v,
              value: typeof v === "string" ? JSON.stringify(v) : String(v),
              kind: "scalar" as const,
            })),
          };
      } catch {}
      return { name, type: "已采集值", value, kind: "scalar" as const };
    })
  );
}
export function sameFrameAfter(steps: TraceStep[], position: number) {
  // 比较同一调用栈中的下一次停靠；return 后该作用域已结束，不能再寻找“下一行之前”。
  const current = steps[position];
  if (current.event === "return") return undefined;
  for (let i = position + 1; i < steps.length; i++) {
    const next = steps[i];
    if (next.stack.length < current.stack.length) return undefined;
    if (
      next.scope === current.scope &&
      JSON.stringify(next.stack) === JSON.stringify(current.stack)
    )
      return next;
  }
  return undefined;
}
export function flattenedValues(
  nodes: TraceValue[],
  prefix = "",
): TraceValue[] {
  return nodes.flatMap((node) => {
    const name = prefix
      ? node.name.startsWith("[")
        ? prefix + node.name
        : prefix + "." + node.name
      : node.name;
    return [{ ...node, name }, ...flattenedValues(node.children ?? [], name)];
  });
}
export function observedOperation(
  code: string,
  step: TraceStep,
  after?: TraceStep,
) {
  const statement = code.split("\n")[step.line - 1]?.trim() ?? "";
  // 只有 line 事件表示执行前；返回或异常帧不能再次套用该源码行的赋值动画。
  if (step.event !== "line") return { statement, kind: "statement" as const };
  const expressionLine = /["']/.test(statement)
    ? ""
    : statement.split(";")[0].split("#")[0].trim();
  if (/^(for|while|if|else)\b/.test(statement))
    return { statement, kind: "control" as const };
  const m = expressionLine.match(
    /^(?:(?:const|unsigned|signed|long|short|int|float|double|auto|size_t)\s+)*(\*?\w+(?:\.\w+)*)\s*(\+=|-=|\*=|\/=|=)\s*(.*?)\s*;?$/,
  );
  if (!m) return { statement, kind: "statement" as const };
  const all = flattenedValues(observedValues(step)),
    next = after ? flattenedValues(observedValues(after)) : [];
  const find = (name: string, list: TraceValue[]) => {
    if (name.startsWith("*"))
      return list.find((n) => n.name === name.slice(1) + "." + name)?.value;
    const exact = list.find((n) => n.name === name);
    if (exact) return exact.value;
    const member = list.filter(
      (n) => n.name.endsWith("." + name) && !n.unavailable,
    );
    return member.length === 1 ? member[0].value : undefined;
  };
  const before = find(m[1], all),
    result = find(m[1], next);
  const operands = [
    ...new Set(m[3].match(/\b[a-zA-Z_]\w*(?:\.\w+)*\b/g) ?? []),
  ].flatMap((name) => {
    const value = find(name, all);
    return value === undefined ? [] : [{ name, value }];
  });
  return {
    statement,
    kind: "assignment" as const,
    target: m[1],
    operator: m[2],
    expression: m[3],
    before,
    result,
    operands,
  };
}
