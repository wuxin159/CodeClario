import type { Scene, SceneStep } from "./scenes.ts";

export const SCENE_SEGMENT_MS = 1600;
export const clampTime = (time: number, count: number) =>
  Math.max(
    0,
    Math.min(Math.max(0, count - 1), Number.isFinite(time) ? time : 0),
  );
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const ease = (t: number) => t * t * (3 - 2 * t);
export function sceneFrame(scene: Scene, time: number) {
  const cursor = clampTime(time, scene.steps.length);
  const index = Math.floor(cursor);
  return {
    cursor,
    index,
    from: scene.steps[index],
    to: scene.steps[Math.min(index + 1, scene.steps.length - 1)],
    progress: cursor - index,
  };
}
export function changedValues(from: SceneStep, to: SceneStep) {
  return Object.keys(to.values).filter(
    (key) => to.values[key] !== from.values[key],
  );
}

export function objectLinksAt(
  scene: Scene,
  index: number,
): NonNullable<SceneStep["links"]> {
  const step = scene.steps[index];
  if (step.links) return step.links;
  const previous = scene.steps
    .slice(0, index)
    .reverse()
    .find((item) => item.links?.length)?.links;
  if (!previous) return [];
  return previous.map((link) => ({
    ...link,
    from: step.note.includes("调用结束")
      ? "调用方"
      : (link.from
          .split("/")
          .map((name) => name.trim())
          .find((name) => name !== "self")
          ?.replace(/\.\w+\(.*\)$/, "") ?? link.from),
    label: step.note.includes("调用结束") ? "修改已保留" : link.label,
    fields: Object.fromEntries(
      Object.entries(link.fields).map(([key, value]) => [
        key,
        step.values[`${link.to}.${key}`] ?? step.values[key] ?? value,
      ]),
    ),
  }));
}

export function sequenceAt(scene: Scene, index: number) {
  return (
    scene.steps[index].items ??
    scene.steps
      .slice(0, index)
      .reverse()
      .find((step) => step.items !== undefined)?.items ??
    []
  );
}
export function motionFamily(scene: Scene) {
  if (scene.steps.some((step) => step.links?.length)) return "objects";
  if (scene.steps.some((step) => step.branch !== undefined)) return "branch";
  if (scene.steps.some((step) => step.frame !== undefined)) return "call";
  if (scene.steps.some((step) => step.items?.length)) return "sequence";
  if (scene.steps.some((step) => typeof step.values.i === "number"))
    return "loop";
  return "values";
}

// Geometry interpolates; semantic values remain exact authored snapshots.
export function curvePoint(
  start: { x: number; y: number },
  end: { x: number; y: number },
  t: number,
  bend = 0,
) {
  return {
    x: lerp(start.x, end.x, t),
    y: lerp(start.y, end.y, t) + 3 * t * (1 - t) * bend,
  };
}
