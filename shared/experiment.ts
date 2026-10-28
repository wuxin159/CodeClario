import type { RunResult } from "./curriculum.ts";
export type ExperimentRecord = {
  id: string;
  lessonId: string;
  experimentId: string;
  code: string;
  stdin: string;
  result: RunResult;
  referenceSeen: boolean;
  createdAt: number;
};
