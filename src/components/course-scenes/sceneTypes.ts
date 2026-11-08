import type { Lesson } from "../../../shared/curriculum";
import type { Scene } from "../../../shared/scenes";
import type { CourseStageModel } from "../../../shared/courseStageModel";
export type SceneProps = {
  lesson: Lesson; scene: Scene; model: CourseStageModel; progress: number;
  inspect: (title: string, explanation: string) => void;
};
export const shown = (value: unknown) => value === undefined ? "—" : String(value);
