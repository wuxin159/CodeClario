import type { Language } from "./curriculum";
import type { LearningTask } from "./flow";

export type LearningGoal = {
  language: Language;
  aim: string;
  experience: "new" | "some";
  diagnostic: number | null;
};
// A short, reviewed entry question. It is evidence, never an ability score.
export const entryQuestions = {
  c: {
    code: 'int total = 0;\nfor (int i = 1; i < 4; i++) total += i;\nprintf("%d", total);',
    options: ["6", "10", "不确定"],
    correct: 0,
  },
  cpp: {
    code: "int total = 0;\nfor (int i = 1; i < 4; i++) total += i;\ncout << total;",
    options: ["6", "10", "不确定"],
    correct: 0,
  },
  python: {
    code: "total = 0\nfor i in range(1, 4):\n    total += i\nprint(total)",
    options: ["6", "10", "不确定"],
    correct: 0,
  },
};
export type Mission = {
  id: string;
  lessonId: string;
  goal: LearningGoal;
  title: string;
  objective: string;
  reason: string;
  evidence: string[];
  prerequisites: string[];
  strategy: "diagnose" | "practice" | "review" | "advance";
  source: "deepseek" | "learner";
  status: "active" | "paused" | "completed";
  createdAt: number;
  completedAt?: number;
  pausedAt?: number;
  previousId?: string;
};
export type MissionProgress = {
  phase: "predict" | "run" | "revise" | "retest" | "ready";
  episode: LearningTask | null;
  canAdvance: boolean;
  stale: boolean;
  reviewFallback?: boolean;
  courseReview?: { answer: number; correct: boolean };
  verification:
    | "none"
    | "coding"
    | "independent"
    | "assisted"
    | "corrected"
    | "previous"
    | "course";
};
export type MissionSnapshot = {
  active: Mission | null;
  progress: MissionProgress | null;
  recent: Mission[];
  configured: boolean;
};
