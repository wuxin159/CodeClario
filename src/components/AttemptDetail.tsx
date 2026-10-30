import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { findLesson, type RunResult } from "../../shared/curriculum";
import { executionInterruption } from "../../shared/executionFailure";

export default function AttemptDetail({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<{
    code: string;
    stdin: string;
    lessonId: string;
    result: RunResult;
  } | null>(null);
  const [error, setError] = useState("");
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/learning/attempts/${id}`, { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error);
        setData(body);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [id]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        e.preventDefault();
        closeButton.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <section
        className="attempt-detail"
        role="dialog"
        aria-modal="true"
        aria-label="运行记录详情"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <span className="study-eyebrow">历史快照 · 只读</span>
            <h2>{data ? findLesson(data.lessonId)?.title : "运行记录"}</h2>
          </div>
          <button ref={closeButton} aria-label="关闭运行详情" onClick={onClose}>
            <X size={21} />
          </button>
        </header>
        {error ? (
          <p className="study-error">{error}</p>
        ) : !data ? (
          <p>正在读取…</p>
        ) : (
          <>
            <p className="muted-copy">
              这里是这次运行的代码与输入，不会替换当前草稿。
            </p>
            <h3>代码</h3>
            <pre className="snapshot-code">{data.code}</pre>
            <h3>标准输入</h3>
            <pre>{data.stdin || "（空）"}</pre>
            <h3>运行结果 · {data.result.passed ? "样例通过" : "未通过"}</h3>
            <pre>{data.result.stdout || "（无标准输出）"}</pre>
            {executionInterruption(data.result) && <p>{executionInterruption(data.result)}</p>}
            {(data.result.stderr || data.result.compileOutput) && (
              <pre className="study-error">
                {data.result.compileOutput || data.result.stderr}
              </pre>
            )}
            <p>
              {data.result.tests.filter((t) => t.passed).length}/
              {data.result.tests.length} 个样例通过 · {data.result.durationMs}{" "}
              ms
            </p>
          </>
        )}
      </section>
    </div>
  );
}
