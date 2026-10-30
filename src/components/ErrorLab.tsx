import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Play, LoaderCircle, ArrowLeft } from "lucide-react";
import type { Lesson } from "../../shared/curriculum";
import type { TeachingViewContext } from "../../shared/flow";
import type { ExperimentRecord } from "../../shared/experiment";
import { errorExperiment } from "../../shared/errorExperiments";
import ExecutionReplay from "./ExecutionReplay";
import Editor from "./RecoverableEditor";
import { executionInterruption } from "../../shared/executionFailure";
export default function ErrorLab({
  lesson,
  userId,
  context,
  onContext,
  onAnalyze,
  runRef,
  active,
}: {
  lesson: Lesson;
  userId?: string;
  context: string;
  onContext: (v: TeachingViewContext) => void;
  onAnalyze: (v: TeachingViewContext) => void;
  runRef?: Ref<{ run: () => void }>;
  active: boolean;
}) {
  const experiment = errorExperiment(lesson);
  const [code, setCode] = useState(experiment.before),
    [record, setRecord] = useState<ExperimentRecord | null>(null),
    [position, setPosition] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [view, setView] = useState<"edit" | "replay">("edit"),
    [referenceSeen, setReferenceSeen] = useState(false);
  const [input, setInput] = useState(experiment.stdin);
  const edited = useRef(false);
  // 初次恢复实验记录可能较慢，不能用旧记录覆盖恢复期间学生刚输入的实验草稿。
  const observed: TeachingViewContext = {
    kind: "experiment",
    experimentId: experiment.id,
    stepIndex: position,
    draftCode: code,
    draftInput: input,
    ...(record ? { recordId: record.id } : {}),
  };
  useEffect(() => {
    let current = true;
    edited.current = false;
    setCode(experiment.before);
    setInput(experiment.stdin);
    setRecord(null);
    setError("");
    if (userId)
      void fetch("/api/experiments/" + lesson.id)
        .then((r) => r.json())
        .then((data) => {
          if (current && data.userId === userId && data.record) {
            setRecord(data.record);
            if (!edited.current) {
              setCode(data.record.code);
              setInput(data.record.stdin);
              setReferenceSeen(data.record.referenceSeen);
            }
          }
        })
        .catch(() => {
          if (current) setError("上次实验暂未恢复，可以重新运行。");
        });
    return () => {
      current = false;
    };
  }, [lesson.id, userId]);
  useEffect(() => {
    // 隐藏页签仍保留草稿，但不能把后台实验帧发布成当前正在观察的教学画面。
    if (active) onContext(observed);
  }, [active, lesson.id, record?.id, position, code, input]);
  async function run() {
    if (!userId || busy) return;
    setBusy(true);
    setError("");
    const source = code;
    const sourceInput = input;
    try {
      const r = await fetch("/api/experiments/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            lessonId: lesson.id,
            experimentId: experiment.id,
            code: source,
            stdin: sourceInput,
            referenceSeen,
          }),
        }),
        data = await r.json();
      if (!r.ok || data.userId !== userId)
        throw Error(data.error ?? "实验未完成。");
      setRecord(data.record);
      setPosition(0);
      setView(
        data.record.result.trace?.status === "available" ? "replay" : "edit",
      );
      const current: TeachingViewContext = {
        kind: "experiment",
        experimentId: experiment.id,
        recordId: data.record.id,
        stepIndex: 0,
        draftCode: source,
        draftInput: sourceInput,
      };
      onContext(current);
      onAnalyze(current);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useImperativeHandle(runRef, () => ({ run: () => void run() }));
  return (
    <section className="error-lab" aria-label="本课错误实验">
      <header>
        <div>
          <h2>{experiment.title}</h2>
          <p>{experiment.why}</p>
        </div>
        <span>独立实验 · 不计课程通过</span>
      </header>
      <p className="error-lab-question">{experiment.question}</p>
      <div className="experiment-tools">
        <button
          disabled={busy}
          aria-pressed={code === experiment.before}
          onClick={() => {
            edited.current = true;
            setCode(experiment.before);
            setView("edit");
          }}
        >
          载入初始例子
        </button>
        <button
          disabled={busy}
          aria-pressed={code === experiment.after}
          onClick={() => {
            edited.current = true;
            setReferenceSeen(true);
            setCode(experiment.after);
            setView("edit");
          }}
        >
          查看修正参考
        </button>
        {record && (
          <button onClick={() => setView(view === "edit" ? "replay" : "edit")}>
            {view === "edit" ? "观察这次动画" : "继续修改实验"}
          </button>
        )}
      </div>
      {view === "edit" ? (
        <div className="experiment-editor">
            <Editor
              value={code}
              onChange={(value) => { edited.current = true; setCode(value); }}
              language={lesson.language}
            />
        </div>
      ) : (
        record && (
          <ExecutionReplay
            result={record.result}
            code={record.code}
            stale={record.code !== code || record.stdin !== input}
            context={"experiment:" + context + ":" + code}
            onViewedStep={setPosition}
          />
        )
      )}
      {view === "edit" && (
        <details className="experiment-input">
          <summary>程序需要标准输入时，在这里填写</summary>
          <textarea
            aria-label="实验标准输入"
            value={input}
            maxLength={4000}
            onChange={(e) => { edited.current = true; setInput(e.target.value); }}
            rows={2}
          />
        </details>
      )}
      {code !== experiment.before && code !== experiment.after && (
        <p className="experiment-free">
          已自由改写：AI会按这次代码和实际结果讲解，原课程草稿保持不变。
        </p>
      )}
      <div className="experiment-run">
        <small>
          实验草稿在本课页签间保留；运行后保存实验记录。{" "}
          {referenceSeen
            ? "已看过修正参考，原课程草稿保持不变。"
            : "可以只改一个数字或符号，再运行对比。"}{" "}
          {record && (record.code !== code || record.stdin !== input)
            ? "下方结果来自上次版本，尚未运行新修改。"
            : ""}
        </small>
        <button
          className="button primary"
          disabled={busy || !userId}
          onClick={() => void run()}
        >
          {busy ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Play size={16} />
          )}{" "}
          {busy ? "实验运行中…" : "运行实验"}
        </button>
      </div>
      {record && (
        <div className="experiment-result">
          <b>
            {record.result.status === "success" ? "本次实际输出" : "本次错误"}
          </b>
          <pre>
            {record.result.stdout ||
              record.result.stderr ||
              record.result.compileOutput ||
              executionInterruption(record.result) ||
              "（无标准输出）"}
          </pre>
          <small>实验结果与主编辑器、课程成绩分别保存。</small>
        </div>
      )}
      {error && (
        <p role="alert" className="task-warning">
          {error}
        </p>
      )}
    </section>
  );
}
