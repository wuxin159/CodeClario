export type DiscoveryValues = { value: number | null; copy: number | null };
export type DiscoveryExperiment = "change-output" | "write-through-pointer";
export type DiscoveryObservation = {
  code: string;
  revision: string;
  stdout: string;
  values: { value: number; copy: number };
  durationMs: number;
  trace: { available: boolean; steps: number; pointerTarget: "value" | null; notice: string };
};
export type DiscoveryGuide = {
  provider: "deepseek" | "guided";
  experimentId: DiscoveryExperiment;
  title: string;
  summary: string;
  question: string;
  rationale: string;
};
export type DiscoveryCheck = {
  prediction: DiscoveryValues;
  correct: boolean;
  attempts: number;
  assisted: boolean;
  corrected: boolean;
  repeated: boolean;
};
export type DiscoverySession = {
  id: string;
  userId: string | null;
  initialValue: number;
  stage: "predict" | "compare" | "check" | "complete";
  code: string;
  prediction?: DiscoveryValues;
  reason?: string;
  baseline?: DiscoveryObservation;
  guide?: DiscoveryGuide;
  comparisonCode?: string;
  comparisonPrediction?: DiscoveryValues;
  comparison?: DiscoveryObservation;
  checkCode?: string;
  checkHelpSeen: boolean;
  checkResult?: DiscoveryCheck;
  checkObservation?: DiscoveryObservation;
  createdAt: number;
  updatedAt: number;
};
export type DiscoverySnapshot = { userId: string | null; configured: boolean; session: DiscoverySession | null };

// 每种变化均来自审校模板，访客只能调整数值，不能把任意代码送入公开执行入口。
export function discoveryCode(initial: number, kind: "baseline" | DiscoveryExperiment | "transfer") {
  const operation = kind === "write-through-pointer" ? "*p += 1;" : kind === "transfer" ? "*p += 2;" : "copy += 1;";
  const output = kind === "change-output"
    ? 'printf("%d %d\\n", copy, value);'
    : 'printf("%d %d\\n", value, copy);';
  return `#include <stdio.h>\n\nint main(void) {\n    int value = ${initial};\n    int *p = &value;\n    int copy = *p;\n    ${operation}\n    ${output}\n    return 0;\n}`;
}
export function discoveryCheckLabel(check?: DiscoveryCheck) {
  if (!check) return "待检验";
  if (!check.correct) return "再观察一步";
  if (check.repeated) return "重复练习通过";
  if (check.corrected) return "订正后通过";
  return check.assisted ? "辅助后通过" : "本次独立回答正确";
}
