import { useEffect, useId, useState } from "react";
import { Check, CircleHelp } from "lucide-react";
import type { Question, StudyRecord } from "../../shared/teaching";

export default function UnderstandingQuestion({
  question,
  record,
  onSubmit,
}: {
  question: Question;
  record?: StudyRecord;
  onSubmit: (kind: Question["id"], answer: number) => Promise<void>;
}) {
  const saved = record?.[question.id];
  const [answer, setAnswer] = useState<number | undefined>(saved?.answer);
  const instance = useId();
  useEffect(() => setAnswer(saved?.answer), [question.id, saved?.answer]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const visible = saved && saved.answer === answer;
  return (
    <section
      className={`understanding-question ${question.id}`}
      aria-label={question.id === "prediction" ? "课前预测" : "理解检查"}
    >
      <div className="question-heading">
        <CircleHelp size={17} />
        <b>
          {question.id === "prediction" ? "先做一个预测" : "换个情形，检查理解"}
        </b>
        {visible && (
          <span className={saved.correct ? "correct" : "retry"}>
            {saved.correct ? "已通过本题" : "待复核"}
          </span>
        )}
      </div>
      <p>{question.prompt}</p>
      <fieldset disabled={busy}>
        <legend className="sr-only">选择答案</legend>
        {question.options.map((option, i) => (
          <label key={option} className={answer === i ? "selected" : ""}>
            <input
              type="radio"
              name={`${question.id}-answer-${instance}`}
              checked={answer === i}
              onChange={() => {
                setAnswer(i);
                setError("");
              }}
            />
            <span>{option}</span>
          </label>
        ))}
      </fieldset>
      <button
        className="question-submit"
        disabled={answer === undefined || busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await onSubmit(question.id, answer!);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "正在保存…" : visible ? "再次检查" : "验证并记录"}
        <Check size={14} />
      </button>
      {visible && (
        <div
          className={`question-feedback ${saved.correct ? "correct" : "retry"}`}
        >
          {question.explanation}
          {!saved.correct && " 可以先观察演示，再换一个答案。"}
        </div>
      )}
      {error && (
        <p className="study-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
