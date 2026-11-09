import type { LearningTask, TeachingDecision } from "./flow";

export const foundationPolicy = "foundation-first-20261108";

export function foundationExplained(task: LearningTask): boolean {
  return task.foundation?.policy === foundationPolicy && !!task.foundation.explained;
}

export function readyForPrediction(task: LearningTask): boolean {
  return foundationExplained(task) && !!task.foundation?.responded;
}

// 这里只记录教学先后，不把一次回应当成理解通过，也不改变课程成绩。
export function noteFoundationResponse(task: LearningTask, answer: string) {
  // 明确表示没懂时继续基础讲解；放行预测也只代表可以继续提问，不代表掌握。
  if (/不懂|没懂|不明白|不理解|看不懂|不知道|不确定/.test(answer)) {
    if (foundationExplained(task)) task.foundation = { ...task.foundation!, responded: false };
    return;
  }
  if (foundationExplained(task) && task.decision?.responseMode === "discussion" && task.decision.question) {
    task.foundation = { ...task.foundation!, responded: true };
  }
}

export function noteFoundationExplanation(task: LearningTask, decision: TeachingDecision) {
  if (decision.introduction && !foundationExplained(task)) {
    task.foundation = { policy: foundationPolicy, explained: true, responded: false };
  }
}
