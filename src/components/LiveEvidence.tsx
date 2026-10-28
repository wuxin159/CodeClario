import { useEffect, useState } from "react";
import type { RunResult } from "../../shared/curriculum";
export default function LiveEvidence({
  result,
  stale,
  focus,
  onStep,
  onViewedStep,
}: {
  result: RunResult | null;
  stale: boolean;
  focus?: { step: number; nonce: number; variable?: string };
  onStep: (line: number) => void;
  onViewedStep?: (index: number) => void;
}) {
  const [position, setPosition] = useState(0),
    steps = result?.trace?.steps ?? [];
  useEffect(() => setPosition(0), [result?.id]);
  useEffect(() => {
    if (focus && steps.length)
      setPosition(Math.min(steps.length - 1, Math.max(0, focus.step - 1)));
  }, [focus?.nonce]);
  const step = steps[position];
  useEffect(
    () => onViewedStep?.(position),
    [position, result?.id, onViewedStep],
  );
  useEffect(() => {
    onStep(step?.line ?? 0);
  }, [step?.line, result?.id]);
  return (
    <section className="live-evidence" aria-label="真实执行观察">
      <header>
        <span className="evidence-dot" />
        <b>执行观察</b>
        <small>{result ? "运行结果" : "等待运行"}</small>
      </header>
      {stale && <p className="task-warning">旧版本结果，等待重新运行。</p>}
      {!result ? (
        <div className="evidence-empty">
          <h3>运行后查看状态</h3>
          <p>
            运行后核对输出。受支持的C、C++和Python代码可以逐步查看变量，再打开“我的代码动画”观察变化。
          </p>
        </div>
      ) : (
        <>
          <div className="live-output">
            <small>{step ? "截至此步的输出" : "实际标准输出"}</small>
            <pre>{(step ? step.output : result.stdout) || "（尚无输出）"}</pre>
            <span>{result.passed ? "样例通过" : "仍有样例未通过"}</span>
          </div>
          {step ? (
            <>
              <div className="live-step">
                <b>
                  第 {position + 1} / {steps.length} 步
                </b>
                <small>
                  {step.event === "line"
                    ? `第${step.line}行执行前`
                    : step.event === "return"
                      ? "当前作用域已结束"
                      : "发生异常"}
                </small>
                <input
                  aria-label="执行观察步骤"
                  type="range"
                  min={0}
                  max={steps.length - 1}
                  value={position}
                  onChange={(e) => setPosition(Number(e.target.value))}
                />
              </div>
              <div className="live-values">
                {Object.entries(step.values).map(([name, value]) => (
                  <div
                    key={name}
                    className={
                      (focus?.variable === name ? "focused " : "") +
                      (position > 0 &&
                      steps[position - 1].values[name] !== value
                        ? "changed"
                        : "")
                    }
                  >
                    <code>{name}</code>
                    <pre key={value}>{value}</pre>
                  </div>
                ))}
                {!Object.keys(step.values).length && (
                  <small>当前作用域尚无已记录变量</small>
                )}
              </div>
              <details>
                <summary>调用栈 · {step.stack.length}层</summary>
                <pre>{step.stack.join("\n")}</pre>
              </details>
              <details className="live-final-output">
                <summary>本次最终输出</summary>
                <pre>{result.stdout || "（无输出）"}</pre>
              </details>
              {result.trace?.truncated && (
                <small>轨迹已截断，仅展示已采集事件。</small>
              )}
            </>
          ) : (
            <p className="evidence-boundary">
              {result.trace?.reason ?? "本次没有变量轨迹。"}{" "}
              可切换到课程演示观察概念模型。
            </p>
          )}
        </>
      )}
    </section>
  );
}
