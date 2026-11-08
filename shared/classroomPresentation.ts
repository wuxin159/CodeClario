import type { Lesson } from "./curriculum.ts";
import type { Scene } from "./scenes.ts";
import { sceneFrame, objectLinksAt } from "./sceneMotion.ts";

/** 只解释审校课程快照；整数值不插值，也不把示意关系当成真实地址。 */
export function loopPresentation(lesson: Lesson, scene: Scene, time: number) {
  const { index, from, to, progress } = sceneFrame(scene, time);
  const previous = scene.steps[Math.max(0, index - 1)];
  const pythonRange = lesson.language === "python" && lesson.topic === "for";
  const range = scene.code.match(/range\(1,\s*(\d+)\)/);
  const condition = scene.code.match(/i\s*(<=|<)\s*(\d+)/);
  const bound = Number(pythonRange ? range?.[1] : condition?.[2]) || 1;
  const inclusive = !pythonRange && condition?.[1] === "<=";
  const ended = from.phase === "循环结束" || Boolean(from.output);
  const total = Number(from.values.total ?? 0);
  const added = index > 0 && total !== Number(previous.values.total ?? 0);
  const phase = ended ? 4 : index === 0 ? 0 : added ? 2 : /条件|取下/.test(from.phase) ? 1 : 3;
  const additions = scene.steps.slice(0, index + 1).flatMap((step, n, all) => {
    if (!n || Number(step.values.total) === Number(all[n - 1].values.total)) return [];
    if (typeof step.values.i !== "number") return [];
    return [{ value: step.values.i, before: Number(all[n - 1].values.total ?? 0), after: Number(step.values.total) }];
  });
  return { index, from, to, progress, pythonRange, bound, inclusive, ended, total, phase, additions,
    current: from.values.i,
    operation: added ? `${previous.values.total ?? 0} + ${from.values.i} = ${total}` : null,
    labels: pythonRange ? ["建立范围", "取下一项", "加入总和", "继续取值", "范围用尽"] : ["初始化", "判断条件", "执行累加", "更新 i", "离开循环"],
  };
}

export function pointerPresentation(scene: Scene, time: number) {
  const frame = sceneFrame(scene, time);
  const prototype = scene.steps.find(step => step.links?.length)?.links?.[0];
  const link = objectLinksAt(scene, frame.index)[0];
  const name = prototype?.to ?? "value";
  const value = link ? Object.values(link.fields)[0] : frame.from.values[name];
  const previous = frame.index > 0 ? objectLinksAt(scene, frame.index - 1)[0] : undefined;
  const oldValue = previous ? Object.values(previous.fields)[0] : undefined;
  return { ...frame, name, value, oldValue, access: prototype?.from ?? "p", linked: Boolean(link), changed: oldValue !== undefined && oldValue !== value };
}
