import type { SceneOptions } from "./scenes.ts";
export type TeachingViewContext =
  | {
      kind: "lesson";
      sceneId: string;
      options: SceneOptions;
      stepIndex: number;
    }
  | { kind: "execution"; attemptId: string; stepIndex: number }
  | {
      kind: "experiment";
      experimentId: string;
      recordId?: string;
      stepIndex: number;
      draftCode?: string;
      draftInput?: string;
    };
export type TraceStep = {
  // line 是该行执行前，return 是当前作用域退出时；两者可能使用相同的源码行号。
  line: number;
  event: "line" | "return" | "exception";
  scope: string;
  values: Record<string, string>;
  stack: string[];
  output: string;
  data?: TraceValue[];
  frames?: {
    name: string;
    line: number;
    values: Record<string, string>;
    data: TraceValue[];
  }[];
  returned?: string;
  returnTarget?: string;
};
export type TraceValue = {
  name: string;
  type: string;
  value: string;
  kind: "scalar" | "array" | "object" | "pointer" | "reference";
  address?: string;
  target?: string;
  size?: number;
  unavailable?: boolean;
  children?: TraceValue[];
};
export type ExecutionTrace = {
  status: "available" | "unsupported" | "unavailable";
  reason?: string;
  truncated?: boolean;
  steps: TraceStep[];
  provenance?: string;
  notice?: string;
};
export type Prediction = {
  kind: "output" | "variable" | "line";
  value: string;
  target?: string;
  spoken?: string;
};
export type Comparison = {
  label: string;
  predicted: string;
  actual: string | null;
  matches: boolean | null;
  reason?: string;
};
export type TeachingDecision = {
  introduction?: { why: string; goal: string };
  action: "ask" | "explain" | "visualize" | "retest" | "continue";
  title: string;
  summary: string;
  question?: string;
  responseMode?: "discussion" | "prediction";
  predictedOutput?: string;
  hypothesis?: string;
  evidence: string[];
  focus?: {
    source: "execution" | "lesson";
    line?: number;
    step?: number;
    variable?: string;
    sceneId?: string;
    options?: SceneOptions;
  };
  sources: { id: string; title: string; excerpt: string }[];
  tools: string[];
  provider: "deepseek" | "program";
  retestId?: string;
  nextLessonId?: string;
};
export type Retest = {
  id: string;
  title: string;
  prompt: string;
  code: string;
  options: string[];
};
export type RetestResult = {
  // 最终答对与独立首次通过是不同证据，帮助、订正和重复记录必须一起保留。
  assisted?: boolean;
  attempts?: number;
  corrected?: boolean;
  repeated?: boolean;
  answer: number;
  correct: boolean;
  explanation: string;
};
export type LearningTask = {
  missionId?: string;
  parentTaskId?: string;
  introductionVersion?: string;
  viewContext?: TeachingViewContext;
  practicePassed?: boolean;
  retestAvailable?: boolean;
  retestAssisted?: boolean;
  retestCorrection?: { taskId: string; answer: number; attempts?: number };
  id: string;
  lessonId: string;
  revision: string;
  code: string;
  stdin: string;
  prediction?: Prediction;
  comparison?: Comparison;
  attemptId?: string;
  trigger: string;
  decision?: TeachingDecision;
  answers: {
    question: string;
    answer: string;
    viewContext?: TeachingViewContext;
  }[];
  retest?: Retest;
  retestResult?: RetestResult;
  state: "predicting" | "observing" | "guiding" | "retesting" | "reviewed";
  createdAt: number;
  updatedAt: number;
};
export type FlowHistoryItem = Pick<
  LearningTask,
  "id" | "lessonId" | "state" | "updatedAt" | "comparison" | "retestResult"
> & { title: string };

export type TeachingConversationEvent = {
  id: number;
  taskId: string;
  revision: string;
  kind: string;
  createdAt: number;
  payload: unknown;
};
