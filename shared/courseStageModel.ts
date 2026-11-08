import type { Lesson } from "./curriculum.ts";
import type { Scene } from "./scenes.ts";
import { sceneFrame, sequenceAt, objectLinksAt } from "./sceneMotion.ts";
import { visualLesson } from "./visualLessons.ts";

/** 只读取课程作者提供的快照，历史用于保留仍存在的数据；不用于推断任意学生源码。 */
export function courseStageModel(lesson: Lesson, scene: Scene, time: number) {
  const frame = sceneFrame(scene, time), history = scene.steps.slice(0, frame.index + 1);
  const values = Object.assign({}, ...history.map(step => step.values)) as Record<string,string|number>;
  const previous = scene.steps[Math.max(0, frame.index - 1)];
  const initialItems = scene.steps.find(step => step.items)?.items ?? [];
  const links = objectLinksAt(scene, frame.index);
  return { ...frame, previous, history, values, initialItems, links,
    items: sequenceAt(scene, frame.index), kind: visualLesson(lesson).kind,
    changedFields: links.flatMap((link, i) => Object.keys(link.fields).filter(key => {
      const old = objectLinksAt(scene, Math.max(0, frame.index - 1))[i];
      return old && old.fields[key] !== link.fields[key];
    })),
  };
}
export type CourseStageModel = ReturnType<typeof courseStageModel>;

export function sequenceLimit(lesson: Lesson, scene: Scene, count: number) {
  if (lesson.id === "c-18" || lesson.id === "cpp-10") return count;
  // 这里只匹配已审校的基础遍历示例，不将正则当作通用代码解析器。
  const text = lesson.language === "python" ? scene.code.match(/numbers\[:(\d+)\]/)?.[1] : scene.code.match(/i\s*<\s*(\d+)/)?.[1];
  return text === undefined ? count : Number(text);
}
export function filterResult(model: CourseStageModel): number[] {
  const raw = model.values["新列表"];
  if (typeof raw !== "string") return [];
  try { const data: unknown = JSON.parse(raw); return Array.isArray(data) && data.every(Number.isFinite) ? data : []; }
  catch { return []; }
}
