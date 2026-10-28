import { lessons, type Language } from "../shared/curriculum.ts";
import { teachingPlan } from "../shared/teaching.ts";

// Search reviewed course sections across lessons; excerpts retain a stable source.
export function searchKnowledge(query: string, language: Language) {
  const normalized = query.toLowerCase().slice(0, 1000);
  const tokens = [
    ...new Set([
      ...(normalized.match(/[a-z_][a-z_0-9+]{1,}/g) ?? []),
      ...(normalized.match(/[\u4e00-\u9fff]+/g) ?? []).flatMap((s) =>
        Array.from({ length: Math.max(0, s.length - 1) }, (_, i) =>
          s.slice(i, i + 2),
        ),
      ),
    ]),
  ].filter(
    (t) =>
      ![
        "代码",
        "当前",
        "学生",
        "问题",
        "运行",
        "结果",
        "什么",
        "一个",
      ].includes(t),
  );
  return lessons
    .filter((l) => l.language === language)
    .flatMap((lesson) =>
      teachingPlan(lesson).sections.map((section, i) => {
        const header = [lesson.title, ...lesson.concepts, section.title]
          .join(" ")
          .toLowerCase();
        const body = section.text.toLowerCase();
        const score = tokens.reduce(
          (n, t) =>
            n + (header.includes(t) ? 4 : 0) + (body.includes(t) ? 1 : 0),
          0,
        );
        return {
          id: `${lesson.id}/intro-v3/${i}`,
          lessonId: lesson.id,
          title: `${lesson.title} · ${section.title}`,
          excerpt: section.text,
          score,
        };
      }),
    )
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, 3);
}
