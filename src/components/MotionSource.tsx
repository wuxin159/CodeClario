import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ease, lerp } from "../../shared/sceneMotion";

export default function MotionSource({
  code,
  fromLine,
  toLine,
  progress,
  language,
  reduced = false,
}: {
  code: string;
  fromLine: number;
  toLine: number;
  progress: number;
  language: string;
  reduced?: boolean;
}) {
  const source = useRef<HTMLPreElement>(null);
  const [rows, setRows] = useState<{ top: number; height: number }[]>([]);
  useLayoutEffect(() => {
    const node = source.current;
    if (!node) return;
    const measure = () =>
      setRows(
        Array.from(
          node.querySelectorAll<HTMLElement>(".motion-source-line"),
        ).map((row) => ({ top: row.offsetTop, height: row.offsetHeight })),
      );
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, [code]);
  useEffect(() => {
    const node = source.current;
    const row = rows[toLine - 1] ?? rows[fromLine - 1];
    if (!node || !row || node.clientHeight === 0) return;
    const top = node.scrollTop;
    if (
      row.top < top + 6 ||
      row.top + row.height > top + node.clientHeight - 6
    ) {
      node.scrollTo({
        top: Math.max(0, row.top - node.clientHeight * 0.35),
        behavior: reduced ? "instant" : "smooth",
      });
    }
  }, [fromLine, toLine, rows, reduced]);
  const a = rows[fromLine - 1],
    b = rows[toLine - 1] ?? a;
  return (
    <div className="scene-source motion-source">
      <div className="scene-source-caption">{language} · 课程示例片段</div>
      <pre ref={source} tabIndex={0} role="region" aria-label="课程示例代码">
        {a && (
          <div
            className="motion-code-indicator"
            aria-hidden="true"
            style={{
              transform: `translateY(${lerp(a.top, b.top, ease(progress))}px)`,
              height: lerp(a.height, b.height, ease(progress)),
            }}
          />
        )}
        {code.split("\n").map((line, i) => (
          <div
            key={i}
            className="motion-source-line"
            aria-current={fromLine === i + 1 ? "step" : undefined}
          >
            <span>{i + 1}</span>
            <code>{line || " "}</code>
          </div>
        ))}
      </pre>
    </div>
  );
}
