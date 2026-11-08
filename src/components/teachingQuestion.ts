import type { TeachingViewContext } from "../../shared/flow";

export type TeachingQuestionRequest = {
  text: string;
  nonce: number;
  label: string;
  details?: string;
  reference: TeachingViewContext;
};

/** 独立复制发问时的示例参数/步骤，不能让后续播放或参数编辑改变问题的来源。 */
export function captureQuestion(request: TeachingQuestionRequest): TeachingQuestionRequest {
  return structuredClone(request);
}

export function questionContext(reference: TeachingQuestionRequest | undefined, live: TeachingViewContext | undefined) {
  return reference?.reference ?? live;
}

/** 自动草稿可随再次选中更新；学生亲自写过的内容始终保留。 */
export function mergeQuestionDraft(current: string, previousAutomatic: string, incoming: string, edited = false) {
  if (edited && current.trim()) return current;
  return !current.trim() || current === previousAutomatic ? incoming : current;
}
