import type { StudyRecord } from "./teaching";
export type PublicUser = { id: string; username: string; displayName: string };
export type AttemptSummary = {
  id: string;
  lessonId: string;
  passed: boolean;
  date: string;
  duration: number;
};
export type LearningState = {
  study: Record<string, StudyRecord>;
  totals: { runs: number; passed: number; activeDays: number };
  activity: Record<string, number>;
  completed: string[];
  drafts: Record<string, string>;
  inputs: Record<string, string>;
  attempts: AttemptSummary[];
  lastLesson: string;
};
export const emptyLearningState = (): LearningState => ({
  study: {},
  totals: { runs: 0, passed: 0, activeDays: 0 },
  activity: {},
  completed: [],
  drafts: {},
  inputs: {},
  attempts: [],
  lastLesson: "c-1",
});
