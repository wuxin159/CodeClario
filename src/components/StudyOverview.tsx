import { ArrowRight, BookOpen, Check, RotateCcw } from "lucide-react";
import { findLesson } from "../../shared/curriculum";
import type { StudyRecord } from "../../shared/teaching";

export default function StudyOverview({
  study,
  onOpen,
}: {
  study: Record<string, StudyRecord>;
  onOpen: (id: string) => void;
}) {
  const records = Object.entries(study).filter(([id]) => findLesson(id));
  const reviews = records.filter(([, r]) => r.review?.correct).length;
  const pending = records.filter(([, r]) => r.review && !r.review.correct);
  return (
    <section className="study-overview panel">
      <div className="study-overview-stats">
        <span>
          <BookOpen size={18} />
          <b>{records.filter(([, r]) => r.visited).length}</b>节已浏览
        </span>
        <span>
          <Check size={18} />
          <b>{reviews}</b>节理解检查通过
        </span>
        <span>
          <RotateCcw size={18} />
          <b>{pending.length}</b>节建议复习
        </span>
      </div>
      {pending.length ? (
        <div className="review-links">
          <small>从这些具体问题继续</small>
          {pending.slice(0, 3).map(([id]) => (
            <button key={id} onClick={() => onOpen(id)}>
              {findLesson(id)!.title}
              <span>{findLesson(id)!.language.toUpperCase()}</span>
              <ArrowRight size={14} />
            </button>
          ))}
        </div>
      ) : (
        <p>理解检查记录本课的局部学习记录，与代码样例通过分别统计。</p>
      )}
    </section>
  );
}
