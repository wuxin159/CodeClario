import type { Language } from "./curriculum.ts";
export type DailyStep = {
  lessonId: string;
  kind: "review" | "practice" | "check";
  title: string;
  reason: string;
  minutes: number;
};
export type DailyPlan = {
  id: string;
  day: string;
  timeZone: string;
  language: Language;
  budget: number;
  greeting: string;
  question: string;
  steps: DailyStep[];
  evidence: string[];
  messages: string[];
  revision: number;
  createdAt: number;
  cycleStartedAt?: number;
  updatedAt: number;
  provider: "deepseek";
};
export type DailySnapshot = {
  userId: string;
  configured: boolean;
  day: string;
  plan: DailyPlan | null;
  progress: {
    state: "pending" | "opened" | "coding" | "verified";
    text: string;
  }[];
};
