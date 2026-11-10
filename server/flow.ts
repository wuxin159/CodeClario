import { fetchAI, parseAIJSON } from "./aiTransport.ts";
import { Router } from "express";
import { createHash, randomUUID } from "node:crypto";
import { requireAccount, requireMatchingAccount } from "./accounts.ts";
import { AccountError, type LearningDatabase } from "./database.ts";
import {
  findLesson,
  lessons,
  type Lesson,
  type RunResult,
} from "../shared/curriculum.ts";
import type {
  Comparison,
  LearningTask,
  Prediction,
  TeachingDecision,
  TeachingViewContext,
} from "../shared/flow.ts";
import { buildScene, defaultSceneOptions } from "../shared/scenes.ts";
import { teachingPlan } from "../shared/teaching.ts";
import { lessonFoundation } from "../shared/lessonFoundations.ts";
import { lessonIntroduction } from "../shared/lessonIntroduction.ts";
import { foundationExplained, readyForPrediction, noteFoundationResponse, noteFoundationExplanation } from "../shared/teachingSequence.ts";
import { errorExperiment } from "../shared/errorExperiments.ts";
import type { ExperimentRecord } from "../shared/experiment.ts";
import { stableTraceEvidence } from "../shared/executionView.ts";
import { executionInterruption } from "../shared/executionFailure.ts";
import { aiConfig } from "./ai.ts";
import { searchKnowledge, knowledgeVersion } from "./knowledge.ts";
import { retrieveKnowledge } from "./knowledgeRewrite.ts";
import { buildTeachingPrompt, teachingPromptVersion, requestedDirectAnswer } from "./prompts/teaching.ts";
import { assertNoCredentials, learningRequestBoundary } from "./aiSafety.ts";
import {runDiagnosticCase} from "./diagnostics.ts";
import {diagnosticCases,type DiagnosticObservation} from "../shared/diagnostics.ts";
import { publicRetest, retestsFor } from "./retests.ts";
import { courseReviewEvidence } from "./missionEvidence.ts";

// 代码相同但输入不同也属于不同证据版本，用分隔符避免直接拼接造成歧义。
const revisionFor = (code: string, stdin: string) =>
  createHash("sha256")
    .update(code + "\0" + stdin)
    .digest("hex")
    .slice(0, 16);
const isViewEvent = (trigger: string) =>
  trigger === "discussion" || trigger === "experiment";
const isExperimentEvent = (
  task: LearningTask,
): task is LearningTask & {
  viewContext: Extract<TeachingViewContext, { kind: "experiment" }>;
} => isViewEvent(task.trigger) && task.viewContext?.kind === "experiment";
const hash = (data: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(data ?? null))
    .digest("hex");
const normalized = (text: string) => text.replace(/\r/g, "").trim();
function lessonViewContext(
  lesson: Lesson,
  raw: any,
): Extract<TeachingViewContext, { kind: "lesson" }> {
  const o = raw?.options,
    min = lesson.index === 3 ? 1 : -9,
    max = lesson.index === 3 ? 8 : lesson.index === 4 ? 9 : 99;
  if (
    !o ||
    typeof o.fixed !== "boolean" ||
    !Number.isInteger(o.value) ||
    o.value < min ||
    o.value > max ||
    typeof o.text !== "string" ||
    o.text.length > 28
  )
    throw new AccountError(400, "课程动画参数无效，请刷新画面后重试。");
  const options = {
    fixed: o.fixed,
    value: o.value,
    text: o.text.replace(/[\x00-\x1f\x7f]/g, " "),
  };
  const scene = buildScene(lesson, options);
  if (
    raw.sceneId !== scene.id ||
    !Number.isInteger(raw.stepIndex) ||
    raw.stepIndex < 0 ||
    raw.stepIndex >= scene.steps.length
  )
    throw new AccountError(400, "课程动画位置已变化，请基于当前画面重新提问。");
  return {
    kind: "lesson",
    sceneId: scene.id,
    options,
    stepIndex: raw.stepIndex,
  };
}
// 教学约束变化时更新策略号，使旧缓存重新校验，而不是继续展示旧规则生成的决定。
const policyVersion = teachingPromptVersion + ":" + knowledgeVersion;
const introductionVersion = "foundation-purpose-v3";
const activeMissionId = (
  store: LearningDatabase,
  userId: string,
  lessonId: string,
): string | undefined =>
  (
    store.db
      .prepare(
        "SELECT id FROM learning_missions WHERE user_id=? AND lesson_id=? AND status='active'",
      )
      .get(userId, lessonId) as any
  )?.id;
const evidenceFor = (
  task: LearningTask,
  result: RunResult | undefined,
  additional: string[],
) => [
  ...new Set([
    "code",
    ...(result ? ["execution"] : []),
    ...(task.prediction ? ["prediction"] : []),
    ...(task.answers.length ? ["answers"] : []),
    ...(task.retestResult ? ["retest"] : []),
    ...(isViewEvent(task.trigger) && task.viewContext
      ? [
          task.viewContext.kind === "lesson"
            ? "lesson_view"
            : task.viewContext.kind === "experiment"
              ? "experiment_view"
              : "execution_view",
        ]
      : []),
    ...additional,
  ]),
];
const executionEvidence = (r?: RunResult | null) =>
  r
    ? {
        status: r.status,
        stdout: r.stdout,
        stderr: r.stderr,
        compileOutput: r.compileOutput,
        exitCode: r.exitCode,
        timedOut: r.timedOut,
        failure: r.failure,
        tests: r.tests,
        trace: stableTraceEvidence(r.trace),
      }
    : null;
export class FlowStore {
  constructor(readonly store: LearningDatabase) {}
  get(userId: string, id: string): LearningTask | undefined {
    const row = this.store.db
      .prepare("SELECT task_json FROM ai_tasks WHERE id=? AND user_id=?")
      .get(id, userId) as { task_json: string } | undefined;
    return row ? this.hydrate(userId, JSON.parse(row.task_json)) : undefined;
  }
  latest(userId: string, lessonId: string): LearningTask | undefined {
    const row = this.store.db
      .prepare(
        "SELECT task_json FROM ai_tasks WHERE user_id=? AND lesson_id=? ORDER BY updated_at DESC,rowid DESC LIMIT 1",
      )
      .get(userId, lessonId) as { task_json: string } | undefined;
    return row ? this.hydrate(userId, JSON.parse(row.task_json)) : undefined;
  }
  history(userId: string, cursor?: string) {
    let boundary: { time: number; id: string } | undefined;
    if (cursor) {
      try {
        if (cursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(cursor))
          throw new Error();
        boundary = JSON.parse(
          Buffer.from(cursor, "base64url").toString("utf8"),
        );
        if (
          !Number.isSafeInteger(boundary?.time) ||
          boundary!.time < 0 ||
          typeof boundary?.id !== "string" ||
          boundary.id.length > 80
        )
          throw new Error();
      } catch {
        throw new AccountError(400, "诊断记录分页位置无效。");
      }
    }
    const rows = (
      boundary
        ? this.store.db
            .prepare(
              "SELECT task_json,updated_at,id FROM ai_tasks WHERE user_id=? AND (updated_at<? OR (updated_at=? AND id<?)) ORDER BY updated_at DESC,id DESC LIMIT 13",
            )
            .all(userId, boundary.time, boundary.time, boundary.id)
        : this.store.db
            .prepare(
              "SELECT task_json,updated_at,id FROM ai_tasks WHERE user_id=? ORDER BY updated_at DESC,id DESC LIMIT 13",
            )
            .all(userId)
    ) as { task_json: string; updated_at: number; id: string }[];
    const last = rows.slice(0, 12).at(-1);
    const items = rows.slice(0, 12).map((row) => {
      const t: LearningTask = JSON.parse(row.task_json);
      return {
        id: t.id,
        lessonId: t.lessonId,
        state: t.state,
        updatedAt: t.updatedAt,
        comparison: t.comparison,
        retestResult: t.retestResult,
        title:
          t.decision?.title ??
          (t.prediction ? "已记录预测" : "等待分析运行证据"),
      };
    });
    return {
      items,
      nextCursor:
        rows.length > 12
          ? Buffer.from(
              JSON.stringify({ time: last!.updated_at, id: last!.id }),
            ).toString("base64url")
          : null,
    };
  }
  private hydrate(userId: string, task: LearningTask) {
    if (task.attemptId && task.practicePassed === undefined)
      task.practicePassed =
        this.store.attempt(userId, task.attemptId)?.result.passed ?? false;
    if (task.practicePassed && !task.retest) {
      const lesson = findLesson(task.lessonId);
      if (lesson)
        task.retestAvailable =
          eligibleRetests(this.store, userId, lesson).length > 0;
    }
    return task;
  }
  create(userId: string, lessonId: string, code: string, stdin: string) {
    const now = Date.now();
    const previous = this.latest(userId, lessonId);
    const task: LearningTask = {
      id: randomUUID(),
      ...(previous ? { parentTaskId: previous.id } : {}),
      // 同账户同课程的后续代码版本延续教学进度；它不是理解成绩。
      ...(previous?.foundation ? { foundation: { ...previous.foundation } } : {}),
      lessonId,
      code,
      stdin,
      revision: revisionFor(code, stdin),
      missionId: activeMissionId(this.store, userId, lessonId),
      trigger: "start",
      answers: [],
      state: "predicting",
      createdAt: now,
      updatedAt: now,
    };
    this.save(userId, task, "start");
    return task;
  }
  save(
    userId: string,
    task: LearningTask,
    kind: string,
    payload: unknown = {},
    evidenceKey?: string,
  ) {
    task.updatedAt = Date.now();
    this.store.db.exec("BEGIN");
    try {
      this.store.db
        .prepare(
          "INSERT INTO ai_tasks(id,user_id,lesson_id,revision,task_json,evidence_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET task_json=excluded.task_json,evidence_key=excluded.evidence_key,updated_at=excluded.updated_at WHERE ai_tasks.user_id=excluded.user_id",
        )
        .run(
          task.id,
          userId,
          task.lessonId,
          task.revision,
          JSON.stringify(task),
          evidenceKey ?? null,
          task.createdAt,
          task.updatedAt,
        );
      this.store.db
        .prepare(
          "INSERT INTO ai_task_events(task_id,kind,payload_json,created_at) VALUES(?,?,?,?)",
        )
        .run(task.id, kind, JSON.stringify(payload), task.updatedAt);
      this.store.db.exec("COMMIT");
    } catch (e) {
      this.store.db.exec("ROLLBACK");
      throw e;
    }
  }
  cached(userId: string, id: string, key: string) {
    return !!this.store.db
      .prepare(
        "SELECT id FROM ai_tasks WHERE id=? AND user_id=? AND evidence_key=?",
      )
      .get(id, userId, key);
  }
  evidenceKey(userId: string, id: string) {
    return (
      (
        this.store.db
          .prepare("SELECT evidence_key FROM ai_tasks WHERE id=? AND user_id=?")
          .get(id, userId) as { evidence_key: string | null } | undefined
      )?.evidence_key ?? undefined
    );
  }
}
export function eligibleRetests(
  store: LearningDatabase,
  userId: string,
  lesson: Lesson,
) {
  const rows = store.db
    .prepare(
      "SELECT json_extract(task_json,'$.retest.id') AS id FROM ai_tasks WHERE user_id=? AND lesson_id=? AND json_extract(task_json,'$.retestResult') IS NOT NULL",
    )
    .all(userId, lesson.id) as { id: string }[];
  const seen = new Set(rows.map((row) => row.id));
  return retestsFor(lesson).filter((test) => !seen.has(test.id));
}
export function previousTaskEvidence(
  store: LearningDatabase,
  userId: string,
  task: LearningTask,
) {
  const flows = new FlowStore(store);
  let parent = task.parentTaskId
    ? flows.get(userId, task.parentTaskId)
    : undefined;
  for (let depth = 0; parent && depth < 6; depth++) {
    if (parent.lessonId !== task.lessonId) break;
    if (parent.attemptId) {
      const previousRun = store.attempt(userId, parent.attemptId)?.result;
      const before = parent.code.split("\n"),
        after = task.code.split("\n");
      return {
        taskId: parent.id,
        revision: parent.revision,
        codeChanged: parent.code !== task.code,
        inputChanged: parent.stdin !== task.stdin,
        lineDifferences: Array.from(
          { length: Math.max(before.length, after.length) },
          (_, i) => ({
            line: i + 1,
            before: before[i] ?? "",
            after: after[i] ?? "",
          }),
        )
          .filter((line) => line.before !== line.after)
          .slice(0, 12)
          .map((line) => ({
            ...line,
            before: line.before.slice(0, 240),
            after: line.after.slice(0, 240),
          })),
        prediction: parent.prediction,
        comparison: parent.comparison,
        answers: parent.answers.slice(-4),
        retestResult: parent.retestResult,
        retest: parent.retest
          ? { id: parent.retest.id, title: parent.retest.title }
          : undefined,
        execution: previousRun
          ? {
              status: previousRun.status,
              passed: previousRun.passed,
              stdout: previousRun.stdout.slice(0, 1200),
              stderr: previousRun.stderr.slice(0, 800),
            }
          : null,
      };
    }
    parent = parent.parentTaskId
      ? flows.get(userId, parent.parentTaskId)
      : undefined;
  }
  return null;
}
export function comparePrediction(
  prediction: Prediction | undefined,
  result: RunResult,
): Comparison | undefined {
  if (!prediction) return;
  let actual: string | null = null,
    reason: string | undefined;
  const label =
    prediction.kind === "output"
      ? "标准输出"
      : prediction.kind === "variable"
        ? `变量 ${prediction.target} 的最终值`
        : `第 ${prediction.target} 行执行次数`;
  if (prediction.kind === "output") {
    if (result.status === "success") actual = result.stdout;
    else reason = "本次程序未正常结束，暂不判定输出预测。";
  } else if (result.trace?.status !== "available")
    reason = "本次未取得可用轨迹，无法核对该预测。";
  else if (result.trace.truncated)
    reason = "轨迹已截断，无法可靠核对最终值或完整执行次数。";
  else if (result.status !== "success")
    reason = "程序未正常结束，暂不判定该预测。";
  else if (
    prediction.kind === "line" &&
    result.trace?.provenance === "native-debug-repeat"
  ) {
    actual = null;
    reason =
      "C/C++复合语句可能在同一行多次停靠，不能直接把停靠次数判成语句或循环执行次数。";
  } else if (prediction.kind === "line")
    actual = String(
      result.trace.steps.filter(
        (s) => s.event === "line" && s.line === Number(prediction.target),
      ).length,
    );
  else {
    const final = result.trace.steps
      .filter((s) => s.event === "return" && s.scope === "<module>")
      .at(-1);
    actual = final?.values[prediction.target!] ?? null;
    if (actual !== null && (actual.includes("…") || /^<[^>]+>$/.test(actual))) {
      actual = null;
      reason = "这个值仅采集了摘要，无法可靠核对完整预测。";
    }
    if (actual === null && !reason)
      reason = "最终全局快照中没有这个变量（局部变量及未采集值不作推测）。";
  }
  return {
    label,
    predicted: prediction.value,
    actual,
    matches:
      actual === null
        ? null
        : normalized(actual) === normalized(prediction.value),
    ...(reason ? { reason } : {}),
  };
}
export function recordFlowRun(
  store: LearningDatabase,
  userId: string,
  code: string,
  stdin: string,
  result: RunResult,
) {
  const flows = new FlowStore(store),
    previous = flows.latest(userId, result.lessonId);
  const task =
    previous &&
    previous.revision === result.revision &&
    previous?.missionId === activeMissionId(store, userId, result.lessonId)
      ? previous
      : flows.create(userId, result.lessonId, code, stdin);
  const previousResult = task.attemptId
    ? store.attempt(userId, task.attemptId)?.result
    : undefined;
  const unchanged =
    !!previousResult &&
    hash(executionEvidence(previousResult)) === hash(executionEvidence(result));
  const oldKey = unchanged ? flows.evidenceKey(userId, task.id) : undefined;
  task.attemptId = result.id;
  task.practicePassed = result.passed;
  task.trigger = "run";
  task.comparison = comparePrediction(task.prediction, result);
  if (!unchanged) {
    task.state = "observing";
    task.decision = undefined;
    // Debug detail can change on a re-run. An already graded answer belongs to
    // this unchanged source/input version, independently of the analysis cache.
    if (!previousResult) {
      task.retest = undefined;
      task.retestResult = undefined;
      task.retestAssisted = undefined;
    }
  }
  // A student may revise their program after answering the only audit question
  // incorrectly. Reopen that old question as a correction, never as a new test.
  if (result.passed && !task.retest) {
    const lesson = findLesson(result.lessonId)!;
    const hasCorrect = store.db.prepare(
      "SELECT 1 FROM ai_tasks WHERE user_id=? AND lesson_id=? AND json_extract(task_json,'$.retestResult.correct')=1 LIMIT 1",
    ).get(userId, lesson.id);
    if (!hasCorrect && !eligibleRetests(store, userId, lesson).length) {
      const oldRows = store.db.prepare(
        "SELECT task_json FROM ai_tasks WHERE user_id=? AND lesson_id=? AND id<>? AND json_extract(task_json,'$.retestResult.correct')=0 ORDER BY updated_at DESC,rowid DESC LIMIT 12",
      ).all(userId, lesson.id, task.id) as { task_json: string }[];
      for (const row of oldRows) {
        const old = JSON.parse(row.task_json) as LearningTask;
        const question = retestsFor(lesson).find((q) => q.id === old.retest?.id);
        if (question && old.retestResult) {
          task.retest = {
            ...publicRetest(question),
            prompt: "回看之前答过的这段程序，结合已看过的解析订正答案。",
          };
          task.retestCorrection = {
            taskId: old.id,
            answer: old.retestResult.answer,
            attempts: old.retestResult.attempts ?? 1,
          };
          task.retestAssisted = true;
          break;
        }
      }
    }
  }
  flows.save(
    userId,
    task,
    "run",
    { attemptId: result.id, comparison: task.comparison },
    oldKey,
  );
  return task.id;
}
export function recordFlowStudy(
  store: LearningDatabase,
  userId: string,
  lessonId: string,
) {
  const flows = new FlowStore(store),
    task = flows.latest(userId, lessonId);
  if (!task || task.missionId !== activeMissionId(store, userId, lessonId))
    return;
  // The old action must not survive a newly graded answer or an interrupted
  // analysis. The next analysis is bound to the newly saved study evidence.
  delete task.decision;
  task.trigger = "study";
  flows.save(userId, task, "study_changed");
}
const active = new Map<string, AbortController>();
const usage = new Map<string, { count: number; reset: number }>();
const tool = (
  name: string,
  description: string,
  properties: object = {},
  required: string[] = [],
) => ({
  type: "function",
  function: {
    name,
    description,
    parameters: {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    },
  },
});
function checkedText(
  value: unknown,
  max: number,
  required = false,
): string | undefined {
  if (
    typeof value !== "string" ||
    value.trim().length > max ||
    (required && !value.trim())
  ) {
    if (required) throw new Error("AI返回的教学内容格式无效，请重试。");
    return undefined;
  }
  return value.trim() || undefined;
}
function introductionIssue(
  task: LearningTask,
  decision: TeachingDecision,
): string | undefined {
  if (
    task.attemptId ||
    foundationExplained(task)
  )
    return;
  if (
    decision.action !== "ask" ||
    !decision.question ||
    decision.responseMode !== "discussion"
  )
    return "首次先讲基础，再问一个容易回答的概念问题；用ask和responseMode=discussion，不要直接要求预测或运行。";
  if (
    decision.summary.length > 140 ||
    /[？?]/.test(decision.summary.replace(/`[^`]*`/g, ""))
  )
    return "首次基础讲解最多140字符，正文只解释概念、不另提问题；唯一的问题放在question字段。";
  if (
    decision.question.length > 80 ||
    (decision.question.match(/[？?]/g)?.length ?? 0) > 1
  )
    return "首次导读一次只提出一个基础问题，80字以内，不要同时询问范围、第一轮和最终输出。";
  if (/预测|猜.*输出|最终.*输出|最后.*输出/.test(decision.question))
    return "先问一个关于语句或执行顺序的基础问题，收到学生回应后再问最终输出预测。";
}
export function validateDecision(
  raw: any,
  lesson: Lesson,
  task: LearningTask,
  result: RunResult | undefined,
  sources: ReturnType<typeof searchKnowledge>,
  usedTools: string[],
  additionalEvidence: string[] = [],
  availableRetestIds?: string[],
): TeachingDecision {
  // 模型只提出候选动作；能否引用轨迹、登记预测或出复测题，必须经过这里的业务约束。
  if (
    !raw ||
    !["ask", "explain", "visualize", "retest", "continue"].includes(raw.action)
  )
    throw new Error("AI未返回有效教学动作，请重试。");
  const validEvidence = evidenceFor(task, result, additionalEvidence);
  if (!readyForPrediction(task) &&
      (raw.responseMode === "prediction" || raw.predictedOutput !== undefined))
    throw new Error("先解释本课用途与基础，提出一个概念问题并等待学生回应，再进入输出预测；基础回应不是理解通过。");
  if (task.attemptId && (raw.responseMode === "prediction" || raw.predictedOutput !== undefined))
    throw new Error("本次已经运行，请结合实际结果讲解，不能要求预测已知输出。");
  // An experiment's provenance is bound by the application to an owned record.
  // Do not make a novice's explanation fail because the model omitted a tag.
  if (isExperimentEvent(task))
    raw = {
      ...raw,
      evidence: [
        "experiment_view",
        ...(task.answers.length ? ["answers"] : []),
      ],
    };
  if (
    !Array.isArray(raw.evidence) ||
    !raw.evidence.length ||
    raw.evidence.some(
      (s: unknown) => typeof s !== "string" || !validEvidence.includes(s),
    )
  )
    throw new Error(
      `evidence只能使用本次已有标签${JSON.stringify(validEvidence)}。previous是history，不能作为本次retest或answers引用。`,
    );
  const decision: TeachingDecision = {
    action: raw.action,
    title: checkedText(raw.title, 48, true)!,
    summary: checkedText(raw.summary, 360, true)!,
    question: checkedText(raw.question, 160),
    responseMode:
      raw.responseMode === "prediction" ? "prediction" : "discussion",
    hypothesis: checkedText(raw.hypothesis, 160)?.replace(
      /^(?:待确认[：:]\s*)+/,
      "",
    ),
    evidence: [...new Set(raw.evidence as string[])],
    sources: [],
    tools: [...new Set(usedTools)],
    provider: "deepseek",
  };
  if (isExperimentEvent(task)) {
    if (decision.action === "retest" || decision.action === "continue")
      decision.action = "explain";
    decision.responseMode = "discussion";
    if (raw.predictedOutput !== undefined)
      throw new Error("错误实验的讨论不能登记成主程序的输出预测。");
  }
  if (
    task.trigger === "prediction_reply" ||
    (task.trigger === "discussion" && raw.predictedOutput !== undefined)
  ) {
    const spoken = task.answers.at(-1)?.answer ?? "";
    if (task.viewContext?.kind === "lesson" && !/我的代码|编辑器/.test(spoken))
      throw new Error(
        "当前讨论课程动画，不能把示例中的数值登记为学生程序的预测。",
      );
    if (task.attemptId)
      throw new Error("不能在已经运行后回填输出预测；请依据真实结果继续讲解。");
    if (
      task.trigger === "discussion" &&
      !(
        (/(?:我(?:觉得|认为|猜|预期|预计)|预期(?:是|为)|应该|会(?:输出|打印))/.test(
          spoken,
        ) &&
          /(?:输出|打印|最后|最终)/.test(spoken)) ||
        (task.prediction && /改(?:为|成)|更正|修改.*预期/.test(spoken))
      )
    )
      throw new Error(
        "这不是明确的最终输出预期，不能把概念回答或提问提取成预测。",
      );
    if (raw.predictedOutput !== undefined) {
      const value = raw.predictedOutput;
      if (typeof value !== "string" || value.length > 1000)
        throw new Error("predictedOutput必须是学生明确说出的标准输出字符串。");
      if (value === "") {
        if (
          !/^(?:我(?:认为|觉得|猜)?(?:应该)?(?:没有|无)输出|(?:没有|无)输出)[。.!！]?\s*$/.test(
            spoken.trim(),
          )
        )
          throw new Error(
            "只有学生明确说没有输出时，才能记录空输出；不确定的回答要追问。",
          );
      } else {
        const position = spoken.lastIndexOf(value);
        if (
          position < 0 ||
          /(?:不是|并非|不会(?:输出|打印)?|不应(?:输出|打印)?)\s*$/.test(
            spoken.slice(0, position),
          )
        )
          throw new Error(
            "提取的输出必须直接来自学生回答，不能提取被否定的候选值，也不能用正确答案替代学生预期。",
          );
        if (
          /^-?\d+(?:\.\d+)?$/.test(value.trim()) &&
          /(?:不确定|没想好|不知道|或者|还是|也可能)/.test(spoken) &&
          !/(?:但|不过|先|就)(?:我)?(?:猜|选|按|认为|觉得)/.test(spoken)
        )
          throw new Error(
            "学生还没有选定一个预期，先ask澄清或允许直接运行，不能替他选择候选值。",
          );
      }
      if (!decision.evidence.includes("answers"))
        throw new Error("提取学生预期必须引用answers证据。");
      decision.predictedOutput = value;
      decision.responseMode = "discussion";
      if (decision.question || decision.action !== "explain")
        throw new Error(
          "明确预期已提取，请用explain确认并引导运行，不再追加问题或提前判对错。",
        );
    } else if (decision.action !== "ask")
      throw new Error(
        "回答含糊时先追问；回答明确时用predictedOutput提取学生说出的输出，不要擅自跳过记录。",
      );
  }
  if (
    /已掌握|完全掌握|熟练掌握|尚未掌握|没有掌握|彻底理解/.test(decision.title)
  )
    throw new Error(
      "标题只能描述本次运行、作答或复测证据，不能把单次表现写成已掌握或未掌握。请改为本次检查通过、需要复核等具体表述。",
    );
  const latestAnswer=task.answers.at(-1)?.answer??"";
  const compactSolution=lesson.solution.replace(/\s/g,"");
  if(!requestedDirectAnswer(latestAnswer)&&!result?.passed&&compactSolution.length>=50&&
      (decision.summary+" "+(decision.question??"")).replace(/\s/g,"").includes(compactSolution))
    throw new Error("学生没有请求完整答案，请改为解释观察依据、定位方向和一个问题，不直接贴出整份参考解。");
  if (decision.action === "ask" && !decision.question)
    throw new Error("AI追问缺少具体问题，请重试。");
  if (task.trigger === "entry" || task.trigger === "practice") {
    const issue = introductionIssue(task, decision);
    if (issue) throw new Error(issue);
    if (
      !task.attemptId &&
      !foundationExplained(task)
    ) {
      const intro = lessonIntroduction(lesson);
      decision.introduction = { why: intro.why, goal: intro.goal };
    }
  }
  if (
    result?.passed &&
    task.retestResult?.correct &&
    !isViewEvent(task.trigger) &&
    (decision.action !== "continue" || decision.question)
  )
    throw new Error(
      "编码与迁移检验均已通过，请返回continue确认本次结果，不再要求额外课程理解题或重复作答。",
    );
  if (
    !decision.question &&
    (decision.hypothesis ||
      /请(?:先)?(?:说明|解释|回答|写出|说说|告诉|判断|预测)|？|\?\s*$/.test(
        decision.summary,
      ))
  )
    throw new Error(
      "你的指导包含待确认假设或要求学生回答，但question字段为空。请把可回答的具体问题放入question字段，不能只写在summary中。",
    );
  if (
    decision.action === "continue" &&
    ((result && !result.passed) ||
      (task.retestResult && !task.retestResult.correct))
  )
    throw new Error(
      "当前编码任务或复测仍未通过，不能结束教学。请选择解释、追问或定位，引导修正；学生仍可自行选择其他课程。",
    );
  if (decision.action === "retest") {
    if (task.retestResult)
      throw new Error(
        "本次复测已有判定，请选择讲解、继续或建议其他课程，不能重复布置同一道题。",
      );
    if (!task.attemptId || !result?.passed)
      throw new Error("当前编码检查尚未通过，请先引导修正，不进入迁移复测。");
    if (task.retest && !task.retestResult)
      throw new Error("已有待答复测题，请回应当前疑问或引导作答，不替换题目。");
    const ids = availableRetestIds ?? retestsFor(lesson).map((r) => r.id);
    if (!ids.includes(raw.retestId))
      throw new Error(
        `当前编码检查已经通过；仅复测题ID无效，不需要重复运行。可用新题ID为${JSON.stringify(ids)}，只从中选择。若为空则提供后续课程建议。`,
      );
    decision.retestId = raw.retestId;
    // Independent checks must not include model-generated solution hints.
    // The model chooses an audited question; the pre-answer instruction is neutral.
    decision.summary =
      "当前代码已通过检查。下面换一个小例子，请先独立选择答案，再一起核对。";
    delete decision.question;
    decision.responseMode = "discussion";
  }
  if (raw.nextLessonId !== undefined && !isExperimentEvent(task)) {
    const next = findLesson(raw.nextLessonId);
    if (!next || next.language !== lesson.language || next.id === lesson.id)
      throw new Error("AI推荐课程无效。");
    decision.nextLessonId = next.id;
  }
  if (
    raw.focus &&
    !isExperimentEvent(task) &&
    !(
      task.trigger === "entry" &&
      !task.parentTaskId &&
      !task.attemptId &&
      !task.prediction &&
      !task.answers.length
    )
  ) {
    const f = raw.focus;
    if (f.source === "execution") {
      if (
        !result ||
        result.trace?.status !== "available" ||
        !Number.isInteger(f.step) ||
        f.step < 1 ||
        f.step > result.trace.steps.length
      )
        throw new Error("AI执行步骤定位无效，请重试。");
      const step = result.trace.steps[f.step - 1];
      if (f.line !== undefined && f.line !== step.line)
        throw new Error(
          `focus.step=${f.step}对应真实代码第${step.line}行，而不是第${f.line}行。请只填写已有stepNumber作为focus.step，省略focus.line，由程序推导代码行。`,
        );
      if (
        f.variable !== undefined &&
        (typeof f.variable !== "string" ||
          !Object.hasOwn(step.values, f.variable))
      )
        throw new Error(
          `第${f.step}步只采集了变量${JSON.stringify(Object.keys(step.values))}，请选择实际存在的变量或省略variable。`,
        );
      decision.focus = {
        source: "execution",
        line: step.line,
        step: f.step,
        ...(f.variable ? { variable: f.variable } : {}),
      };
    } else if (f.source === "lesson") {
      const options =
        task.viewContext?.kind === "lesson"
          ? task.viewContext.options
          : defaultSceneOptions(lesson);
      const scene = buildScene(lesson, options);
      if (
        !Number.isInteger(f.step) ||
        f.step < 1 ||
        f.step > scene.steps.length
      )
        throw new Error("AI课程步骤定位无效，请重试。");
      decision.focus = {
        source: "lesson",
        step: f.step,
        line: scene.steps[f.step - 1].line,
        sceneId: scene.id,
        options,
      };
    } else throw new Error("AI定位来源无效，请重试。");
  }
  if (decision.action === "visualize" && !decision.focus)
    throw new Error("AI可视化动作缺少有效定位，请重试。");
  if (raw.sourceIds !== undefined) {
    if (
      !Array.isArray(raw.sourceIds) ||
      raw.sourceIds.some((id: unknown) => !sources.some((s) => s.id === id))
    )
      throw new Error("AI引用的课程来源无效，请重试。");
    decision.sources = sources
      .filter((s) => raw.sourceIds.includes(s.id))
      .map(({ id, title, excerpt }) => ({ id, title, excerpt }));
  }
  return decision;
}
async function decide(
  userId: string,
  lesson: Lesson,
  task: LearningTask,
  store: LearningDatabase,
  controller: AbortController,
  previous: ReturnType<typeof previousTaskEvidence>,
):Promise<TeachingDecision> {
  const config = aiConfig(userId);
  const attempt = task.attemptId ? store.attempt(userId, task.attemptId) : null;
  const result = attempt?.result;
  const interruption = executionInterruption(result);
  // 终止或空诊断不足以证明语法错误；这类反馈由程序给出事实说明，不让模型补猜错因。
  if (interruption && (!isViewEvent(task.trigger) || task.viewContext?.kind === "execution"))
    return {
      action: "explain", title: "先确认这次执行为什么没有完成", summary: interruption,
      evidence: ["execution"], sources: [], tools: ["核对执行终止状态"], provider: "program",
    } satisfies TeachingDecision;
  const study = store.studyRecords(userId)[lesson.id] ?? {};
  const scene = buildScene(
    lesson,
    isViewEvent(task.trigger) && task.viewContext?.kind === "lesson"
      ? task.viewContext.options
      : defaultSceneOptions(lesson),
  );
  const candidates = task.retestResult
    ? []
    : eligibleRetests(store, userId, lesson);
  const retrievalQuery = task.answers.at(-1)?.answer || [lesson.title,...lesson.concepts,task.comparison?.label??""].join(" ");
  const retrieval = await retrieveKnowledge({query:retrievalQuery,language:lesson.language,userId,signal:controller.signal,lessonTitle:lesson.title});
  let sources = retrieval.hits;
  const usedTools = [retrieval.rewritten?"理解问题并检索课程资料":"检索审校课程资料"];
  const toolTrace=[{label:usedTools[0],automatic:true,ok:true}];
  const diagnostics:DiagnosticObservation[]=[];
  const diagnosticOptions=result&&!result.passed&&!isExperimentEvent(task)&&(!isViewEvent(task.trigger)||task.viewContext?.kind!=="lesson")?diagnosticCases(lesson).filter(c=>c.input.trim()!==task.stdin.trim()):[];
  const diagnosticRequested=diagnosticOptions.length>0&&task.trigger==="discussion"&&/(?:换|选|另|额外|新).{0,12}(?:输入|样例)|(?:输入|样例).{0,8}(?:验证|核对)/.test(task.answers.at(-1)?.answer??"");
  const extraEvidence = Object.keys(study).some(
    (k) => k === "prediction" || k === "review",
  )
    ? ["answers"]
    : [];
  if (previous) extraEvidence.push("history");
  const missionRow = store.db
    .prepare(
      "SELECT mission_json FROM learning_missions WHERE user_id=? AND lesson_id=? AND status='active'",
    )
    .get(userId, lesson.id) as any;
  const learningMission = missionRow
    ? JSON.parse(missionRow.mission_json)
    : null;
  const review = learningMission
    ? courseReviewEvidence(store, userId, learningMission)
    : null;
  const pendingCourseReview =
    !!result?.passed && !!review?.required && !review.passed;
  const completedCourseReview =
    !!result?.passed && !!review?.required && review.passed;
  const experimentContext = isExperimentEvent(task) ? task.viewContext : null;
  const experimentRow = experimentContext?.recordId
    ? (store.db
        .prepare(
          "SELECT record_json FROM learning_experiments WHERE id=? AND user_id=? AND lesson_id=?",
        )
        .get(experimentContext.recordId, userId, lesson.id) as any)
    : null;
  const observedExperiment: ExperimentRecord | null = experimentRow
    ? JSON.parse(experimentRow.record_json)
    : null;
  const experimentInterruption = executionInterruption(observedExperiment?.result);
  if (experimentInterruption && experimentContext)
    return {
      action: "explain", title: "先确认这次实验的执行状态", summary: experimentInterruption,
      evidence: ["experiment_view"], sources: [], tools: ["核对实验终止状态"], provider: "program",
    } satisfies TeachingDecision;
  const priorExperimentRow = observedExperiment
    ? (store.db
        .prepare(
          "SELECT record_json FROM learning_experiments WHERE user_id=? AND lesson_id=? AND created_at<? ORDER BY created_at DESC,rowid DESC LIMIT 1",
        )
        .get(userId, lesson.id, observedExperiment.createdAt) as any)
    : null;
  const priorExperiment: ExperimentRecord | null = priorExperimentRow
    ? JSON.parse(priorExperimentRow.record_json)
    : null;
  const exp = errorExperiment(lesson);
  // 补入老师最近的讲解以保持对话连贯，但上下文只能来自同账户、同课、同学习任务。
  const recentTeaching = (
    store.db
      .prepare(
        `SELECT e.kind,e.payload_json,t.revision FROM ai_task_events e
       JOIN ai_tasks t ON t.id=e.task_id
       WHERE t.user_id=? AND t.lesson_id=?
       AND (json_extract(t.task_json,'$.missionId') IS ?)
       AND e.kind IN ('decision','answer','discussion','prediction_reply')
       ORDER BY e.id DESC LIMIT 16`,
      )
      .all(userId, lesson.id, task.missionId ?? null) as any[]
  )
    .reverse()
    .map((row) => {
      const payload = JSON.parse(row.payload_json);
      return row.kind === "decision"
        ? {
            role: "teacher",
            revision: row.revision,
            summary: String(payload.summary ?? "").slice(0, 400),
            question: String(payload.question ?? "").slice(0, 180),
          }
        : {
            role: "student",
            revision: row.revision,
            question: String(payload.question ?? "").slice(0, 180),
            answer: String(payload.answer ?? "").slice(0, 1000),
          };
    });
  const courseReviewQuestion = teachingPlan(lesson).questions.find(
    (question) => question.id === "review",
  );
  const observations = {
    diagnosticCases:diagnosticOptions.map(({id,title,input})=>({caseId:id,title,input})),
    learningMission: learningMission
      ? {
          title: learningMission.title,
          objective: lesson.task,
          goal: learningMission.goal,
          reason: learningMission.reason,
          courseReview: review
            ? {
                ...review,
                question:
                  review.required && courseReviewQuestion
                    ? {
                        prompt: courseReviewQuestion.prompt,
                        options: courseReviewQuestion.options,
                        code: buildScene(lesson, defaultSceneOptions(lesson))
                          .code,
                        provenance: "页面现有课程理解题，和编辑器程序分别记录",
                      }
                    : undefined,
              }
            : null,
        }
      : null,
    availableEvidence: evidenceFor(task, result, extraEvidence),
    phase: !result
      ? "awaiting_run"
      : !result.passed
        ? "needs_revision"
        : review?.required
          ? review.passed
            ? "reviewed"
            : "needs_course_review"
          : task.retestResult
            ? task.retestResult.correct
              ? "reviewed"
              : "needs_correction"
            : "ready_for_retest",
    trigger: task.trigger,
    event:
      task.trigger === "run" ? {type:"code_run",actor:"program",attemptId:task.attemptId} : task.trigger === "practice"
        ? { type: "practice_opened", actor: "program" }
        : task.trigger === "experiment"
        ? {
            type: "experiment_run",
            actor: "program",
            recordId: experimentContext?.recordId,
          }
        : undefined,
    lesson: lesson.title,
    introduction: {
      ...lessonIntroduction(lesson),
      foundationExplained: foundationExplained(task),
      readyForPrediction: readyForPrediction(task),
      primer: lessonFoundation(lesson),
      prerequisites: teachingPlan(lesson).prerequisites,
      goals: teachingPlan(lesson).goals,
      foundations: teachingPlan(lesson).sections.slice(0, 2),
      firstEncounter:
        !task.attemptId &&
        !foundationExplained(task),
    },
    language: lesson.language,
    task: lesson.task,
    practiceLevel: lesson.practiceLevel??"guided",
    code: task.code,
    viewContext:
      isViewEvent(task.trigger) && task.viewContext
        ? task.viewContext.kind === "lesson"
          ? {
              kind: "lesson",
              sceneId: task.viewContext.sceneId,
              provenance: "课程示例，非学生代码真实执行",
              // 讲解所看示例时同时给出它的源码，避免把示例行号套到学生编辑器的不同程序上。
              code: scene.code,
              parameters:
                lesson.language!=="java" && lesson.index < 6
                  ? lesson.index === 0
                    ? { text: task.viewContext.options.text }
                    : {
                        value: task.viewContext.options.value,
                        ...(lesson.index >= 2
                          ? {
                              variant: task.viewContext.options.fixed
                                ? "修正示例"
                                : "初始示例",
                            }
                          : {}),
                      }
                  : lesson.topic === "bubble-sort"
                    ? { variant: task.viewContext.options.fixed ? "完整排序" : "只做一轮" }
                    : null,
              stepNumber: task.viewContext.stepIndex + 1,
              currentStep: scene.steps[task.viewContext.stepIndex],
              nextStep: scene.steps[task.viewContext.stepIndex + 1],
            }
          : task.viewContext.kind === "experiment"
            ? {
                ...task.viewContext,
                provenance: observedExperiment
                  ? "错误实验的真实隔离运行，不计课程成绩"
                  : "错误实验草稿，尚未运行",
                title: exp.title,
                why: exp.why,
                question: exp.question,
                code:
                  task.viewContext.draftCode ??
                  observedExperiment?.code ??
                  exp.before,
                stdin:
                  task.viewContext.draftInput ??
                  observedExperiment?.stdin ??
                  exp.stdin,
                executedInput: observedExperiment?.stdin ?? null,
                freelyEdited: ![exp.before, exp.after].includes(
                  task.viewContext.draftCode ??
                    observedExperiment?.code ??
                    exp.before,
                ),
                executedCode: observedExperiment?.code ?? null,
                stale:
                  !!observedExperiment &&
                  ((task.viewContext.draftCode !== undefined &&
                    task.viewContext.draftCode !== observedExperiment.code) ||
                    (task.viewContext.draftInput !== undefined &&
                      task.viewContext.draftInput !==
                        observedExperiment.stdin)),
                result: observedExperiment?.result ?? null,
                stepNumber: task.viewContext.stepIndex + 1,
                currentStep:
                  observedExperiment?.result.trace?.steps[
                    task.viewContext.stepIndex
                  ] ?? null,
                referenceSeen: observedExperiment?.referenceSeen ?? false,
                previousRun: priorExperiment
                  ? {
                      code: priorExperiment.code,
                      stdout: priorExperiment.result.stdout,
                      status: priorExperiment.result.status,
                      stderr: priorExperiment.result.stderr.slice(0, 1600),
                    }
                  : null,
              }
            : {
                ...task.viewContext,
                provenance: "本次学生代码真实执行",
                stepNumber: task.viewContext.stepIndex + 1,
                currentStep: result?.trace?.steps[task.viewContext.stepIndex],
              }
        : null,
    stdin: task.stdin,
    prediction: task.prediction,
    comparison: task.comparison,
    answers: task.answers,
    recentTeaching,
    previous,
    understanding: teachingPlan(lesson).questions.flatMap((question) => {
      const answer = study[question.id];
      return answer
        ? [
            {
              kind: question.id,
              prompt: question.prompt,
              selected: question.options[answer.answer],
              correct: answer.correct,
              scope: "固定课程理解题，与当前编辑器程序分别记录",
            },
          ]
        : [];
    }),
    retest: task.retestResult,
    pendingRetest:
      task.retest && !task.retestResult?.correct
          ? { ...task.retest, assisted: !!task.retestAssisted,correctionOf:task.retestCorrection }
        : null,
    execution: result
      ? {
          passed: result.passed,
          status: result.status,
          exitCode: result.exitCode,
          timedOut: result.timedOut,
          failure: result.failure,
          stdout: result.stdout,
          stderr: result.stderr.slice(0, 1800),
          compileOutput: result.compileOutput.slice(0, 1800),
          tests: result.tests,
          trace: result.trace
            ? {
                ...result.trace,
                steps: result.trace.steps.map((step, index) => ({
                  ...step,
                  stepNumber: index + 1,
                })),
              }
            : undefined,
        }
      : null,
    lessonScene: {
      title: scene.title,
      code: scene.code,
      steps: scene.steps.map((s, i) => ({
        step: i + 1,
        line: s.line,
        note: s.note,
      })),
    },
    knowledge: sources,
    retestCandidates: task.attemptId ? candidates.map(publicRetest) : [],
    courseOptions: lessons
      .filter((l) => l.language === lesson.language)
      .map((l) => ({ id: l.id, title: l.title })),
  };
  const messages: any[] = [
    {role:"system",content:buildTeachingPrompt({firstEncounter:observations.introduction.firstEncounter,foundationReady:readyForPrediction(task),trigger:task.trigger,phase:observations.phase,viewKind:isViewEvent(task.trigger)?task.viewContext?.kind:undefined,diagnosticRequested,directAnswer:(task.trigger==="discussion"||task.trigger==="answer")&&requestedDirectAnswer(task.answers.at(-1)?.answer??""),courseQuestion:pendingCourseReview?courseReviewQuestion?.prompt:undefined})},
    {role:"user",content:JSON.stringify(observations)},
  ];
  const tools = [
    // The model chooses the pedagogical action; validated focus drives the UI.
    tool(
      "search_knowledge",
      "按具体困难检索当前语言的跨课程审校片段。",
      { query: { type: "string", maxLength: 200 } },
      ["query"],
    ),
    tool("read_learning_history", "读取本账户最近诊断和复测证据。"),
    tool("list_retests", "读取适用于本课的受审校复测题。"),
    ...(diagnosticOptions.length?[tool("run_diagnostic_case","选择一个额外输入验证当前错因假设，不改代码、不计成绩；同任务最多两个新输入，已有结果复用。",{caseId:{type:"string",enum:diagnosticOptions.map(c=>c.id)},reason:{type:"string",maxLength:120}},["caseId","reason"])]:[]),
  ];
  for (let round = 0; round < 3; round++) {
    const response = await fetchAI(config.base + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.key}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: 1300,
        temperature: 0.3,
        thinking: { type: "disabled" },
        response_format: { type: "json_object" },
        // 学生明确要求验证时先进入工具步骤；具体输入和理由仍由模型从审校候选中选择。
        ...(round < 2 ? { tools, ...(diagnosticRequested&&round===0?{tool_choice:{type:"function",function:{name:"run_diagnostic_case"}}}:{}) } : {}),
      }),
      signal: controller.signal,
    });
    if (!response.ok)
      throw new AccountError(
        502,
        response.status === 401
          ? "AI认证失败，请检查配置的密钥。"
          : response.status === 402
            ? "AI额度不足，请检查服务账户。"
            : `AI服务暂不可用（${response.status}），本次运行结果已保留。`,
      );
    const data = (await response.json()) as any;
    const message = data.choices?.[0]?.message;
    if (!message) throw new Error("AI未返回有效内容，请重试。");
    if (message.tool_calls?.length && round < 2) {
      if (message.tool_calls.length > 4)
        throw new Error("AI工具请求超出本次限制。");
      messages.push(message);
      for (const call of message.tool_calls) {
        // 只识别白名单工具及受限参数，模型返回的字符串不能变成任意宿主操作。
        let value: unknown = { error: "工具或参数无效" };
        let label="未执行的工具请求",ok=false;
        try {
          const args = JSON.parse(call.function.arguments || "{}");
          if (
            call.function.name === "search_knowledge" &&
            typeof args.query === "string" &&
            args.query.length <= 200 &&
            Object.keys(args).length === 1
          ) {
            const found = searchKnowledge(args.query, lesson.language);
            sources = [
              ...new Map([...sources, ...found].map((s) => [s.id, s])).values(),
            ];
            value = found;
            usedTools.push("按问题检索课程片段");
            label="按问题查阅课程资料";ok=true;
          } else if (
            Object.keys(args).length === 0 &&
            call.function.name === "read_learning_history"
          ) {
            const history = new FlowStore(store)
              .history(userId)
              .items.filter((t) => t.id !== task.id)
              .slice(0, 6);
            value = history;
            if (history.length) extraEvidence.push("history");
            usedTools.push("读取学习与复测记录");
            label="读取你的学习记录";ok=true;
          } else if (
            Object.keys(args).length === 0 &&
            call.function.name === "list_retests"
          ) {
            value = candidates.map(publicRetest);
            usedTools.push("选择审校复测题");
            label="查询可用理解检验";ok=true;
          } else if(call.function.name==="run_diagnostic_case"&&diagnosticOptions.some(c=>c.id===args.caseId)) {
            label="运行额外输入验证";
            const observation=await runDiagnosticCase(store,userId,lesson,task,args,controller.signal);
            if(!diagnostics.some(d=>d.id===observation.id))diagnostics.push(observation);
            extraEvidence.push("diagnostic");value={...observation,evidenceTag:"diagnostic",countsForCourse:false};
            label=observation.reused?"复用已完成的额外验证":"运行一个额外输入验证";ok=true;usedTools.push(label);
          }
        } catch(error) {
          if(controller.signal.aborted)throw error;
          value={error:error instanceof Error?error.message:"工具未完成。"};
        }
        toolTrace.push({label,automatic:false,ok});
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(value),
        });
      }
      continue;
    }
    let parsed;
    try {
      parsed = parseAIJSON(message.content ?? "");
      if(diagnosticRequested&&!toolTrace.some(t=>!t.automatic&&t.label.includes("验证")))throw new Error("学生明确请求额外输入验证，请先调用run_diagnostic_case，不要假称已经验证。");
      if (
        completedCourseReview &&
        !isViewEvent(task.trigger) &&
        (parsed.action !== "continue" ||
          parsed.question ||
          /还差|未完成|尚未.{0,8}作答|待.{0,6}作答/.test(
            String(parsed.title) + " " + String(parsed.summary),
          ))
      )
        throw new Error(
          "程序已确认编码及本任务课程理解题均通过，旧的待作答状态已失效。请返回continue确认本次证据，不要再次要求同题作答或返回question。",
        );
      if (
        pendingCourseReview &&
        (parsed.action === "continue" || parsed.action === "retest")
      )
        throw new Error(
          "本任务还需页面现有的课程理解题，不能提前继续或迁移复测；请改为explain，引导完成主区域的理解检查。",
        );
      const validated=validateDecision(
        parsed,
        lesson,
        task,
        result,
        sources,
        usedTools,
        extraEvidence,
        candidates.map((test) => test.id),
      );
      return {...validated,policyVersion,toolTrace,diagnostics};
    } catch (e) {
      store.db
        .prepare(
          "INSERT INTO ai_task_events(task_id,kind,payload_json,created_at) VALUES(?,?,?,?)",
        )
        .run(
          task.id,
          "decision_rejected",
          JSON.stringify({
            policyVersion,
            round: round + 1,
            reason: (e as Error).message,
            action: parsed?.action ?? null,
            evidence: parsed?.evidence ?? null,
            retestId: parsed?.retestId ?? null,
            focus: parsed?.focus ?? null,
          }),
          Date.now(),
        );
      if (round === 2)
        throw new Error(
          "AI这次未能完成讲解。代码、运行和作答都已保存，可以重试。",
        );
      messages.push(message, {
        role: "user",
        content: `你的输出未通过应用校验：${(e as Error).message}。请依据已有证据修正，返回完整JSON，不添加工具外的事实。`,
      });
    }
  }
  throw new Error("AI本次未完成教学决策，请重试。");
}
export function flowRoutes(store: LearningDatabase) {
  const router = Router(),
    flows = new FlowStore(store);
  router.get("/flow/conversation/:lessonId", requireAccount, (req, res) => {
    const lessonId = String(req.params.lessonId);
    const cursor =
      req.query.before === undefined
        ? Number.MAX_SAFE_INTEGER
        : Number(req.query.before);
    if (!findLesson(lessonId) || !Number.isSafeInteger(cursor) || cursor <= 0) {
      res.status(400).json({ error: "课程或对话分页参数无效。" });
      return;
    }
    const rows = store.db
      .prepare(
        `SELECT e.id,e.task_id,e.kind,e.payload_json,e.created_at,t.revision
      FROM ai_task_events e JOIN ai_tasks t ON t.id=e.task_id
      WHERE t.user_id=? AND t.lesson_id=? AND e.id<?
      AND e.kind IN ('prediction','prediction_reply','answer','discussion','experiment','run','decision','retest')
      ORDER BY e.id DESC LIMIT 41`,
      )
      .all(req.user!.id, lessonId, cursor) as any[];
    const page = rows.slice(0, 40);
    res.json({
      userId: req.user!.id,
      events: page.reverse().map((row) => {
        let payload = JSON.parse(row.payload_json);
        if (row.kind === "run" && payload.attemptId) {
          const result = store.attempt(req.user!.id, payload.attemptId)?.result;
          payload = {
            ...payload,
            result: result
              ? {
                  stdout: result.stdout.slice(0, 1400),
                  status: result.status,
                  passed: result.passed,
                }
              : undefined,
          };
        }
        return {
          id: row.id,
          taskId: row.task_id,
          revision: row.revision,
          kind: row.kind,
          createdAt: row.created_at,
          payload,
        };
      }),
      before: rows.length > 40 ? page[0].id : null,
    });
  });
  router.get("/flow/history", requireAccount, (req, res) => {
    try {
      if (
        req.query.cursor !== undefined &&
        typeof req.query.cursor !== "string"
      )
        throw new AccountError(400, "分页参数无效。");
      res.json({
        userId: req.user!.id,
        ...flows.history(req.user!.id, req.query.cursor as string | undefined),
      });
    } catch (e) {
      res
        .status(e instanceof AccountError ? e.status : 500)
        .json({ error: e instanceof Error ? e.message : "读取失败。" });
    }
  });
  router.get("/flow/task/:id", requireAccount, (req, res) => {
    const task = flows.get(req.user!.id, String(req.params.id));
    if (!task) {
      res.status(404).json({ error: "未找到这条诊断记录。" });
      return;
    }
    res.json({ userId: req.user!.id, task });
  });
  router.get("/flow/:lessonId", requireAccount, (req, res) =>
    res.json({
      userId: req.user!.id,
      task: flows.latest(req.user!.id, String(req.params.lessonId)) ?? null,
    }),
  );
  const source = (body: any) => {
    const lesson = findLesson(body.lessonId);
    if (
      !lesson ||
      typeof body.code !== "string" ||
      body.code.length > 24000 ||
      typeof body.stdin !== "string" ||
      body.stdin.length > 4000
    )
      throw new AccountError(400, "课程、代码或输入无效。");
    return lesson;
  };
  const current = (userId: string, body: any) => {
    const task =
      typeof body.taskId === "string"
        ? flows.get(userId, body.taskId)
        : undefined;
    if (
      !task ||
      task.lessonId !== body.lessonId ||
      task.missionId !== activeMissionId(store, userId, body.lessonId) ||
      task.revision !== revisionFor(body.code, body.stdin)
    )
      throw new AccountError(
        409,
        "这条学习任务已过期，请基于当前代码重新运行。",
      );
    return task;
  };
  const fail = (res: any, e: unknown) =>
    res.status(e instanceof AccountError ? e.status : 500).json({
      error: e instanceof Error ? e.message : "学习任务未完成，请重试。",
    });
  router.post("/flow/predict", requireMatchingAccount, (req, res) => {
    try {
      const lesson = source(req.body),
        p = req.body.prediction as Prediction;
      if (
        !p ||
        !["output", "variable", "line"].includes(p.kind) ||
        typeof p.value !== "string" ||
        p.value.length > 1000
      )
        throw new AccountError(400, "预测格式无效。");
      if (
        p.kind === "variable" &&
        (typeof p.target !== "string" ||
          !/^[_a-zA-Z][_a-zA-Z0-9]{0,40}$/.test(p.target))
      )
        throw new AccountError(400, "请输入一个变量名。");
      if (
        p.kind === "line" &&
        (!/^\d{1,4}$/.test(p.target ?? "") ||
          Number(p.target) < 1 ||
          Number(p.target) > req.body.code.split("\n").length ||
          !/^\d{1,6}$/.test(p.value))
      )
        throw new AccountError(400, "请填写有效行号和非负执行次数。");
      const prediction = {
        kind: p.kind,
        value: p.value,
        ...(p.kind !== "output" ? { target: p.target } : {}),
      };
      const previous = flows.latest(req.user!.id, lesson.id);
      if (!previous || !readyForPrediction(previous))
        throw new AccountError(409, "先跟随老师认识本课基础，再回答老师提出的预测问题。");
      if (previous.attemptId && previous.revision === revisionFor(req.body.code, req.body.stdin))
        throw new AccountError(409, "这份代码和输入已运行，不能把已知结果回填成预测。");
      if (
        previous &&
        previous.missionId ===
          activeMissionId(store, req.user!.id, lesson.id) &&
        !previous.attemptId &&
        previous.revision === revisionFor(req.body.code, req.body.stdin) &&
        hash(previous.prediction) === hash(prediction)
      ) {
        res.json({ task: previous });
        return;
      }
      const task = flows.create(
        req.user!.id,
        lesson.id,
        req.body.code,
        req.body.stdin,
      );
      task.prediction = prediction;
      task.trigger = "prediction";
      flows.save(req.user!.id, task, "prediction", task.prediction);
      res.json({ task });
    } catch (e) {
      fail(res, e);
    }
  });
  router.post("/flow/retest", requireMatchingAccount, (req, res) => {
    try {
      const lesson = source(req.body),
        task = current(req.user!.id, req.body);
      if (!task.attemptId || !task.decision)
        throw new AccountError(409, "请先完成一次运行分析，再进行复测。");
      const retest = retestsFor(lesson).find((r) => r.id === req.body.retestId);
      if (
        !retest ||
        task.retest?.id !== retest.id ||
        !Number.isInteger(req.body.answer) ||
        req.body.answer < 0 ||
        req.body.answer >= retest.options.length
      )
        throw new AccountError(400, "请选择当前复测题的有效选项。");
      if (task.retestResult?.answer === req.body.answer) {
        res.json({ task });
        return;
      }
      if (task.retestResult?.correct)
        throw new AccountError(409, "这道复测已完成，不覆盖已有正确记录。");
      const priorResult = task.retestResult;
      const repeated = !!store.db
        .prepare(
          "SELECT 1 FROM ai_tasks WHERE user_id=? AND lesson_id=? AND id<>? AND json_extract(task_json,'$.retest.id')=? AND json_extract(task_json,'$.retestResult') IS NOT NULL LIMIT 1",
        )
        .get(req.user!.id, lesson.id, task.id, retest.id);
      task.retestResult = {
        answer: req.body.answer,
        correct: req.body.answer === retest.correct,
        explanation: retest.explanation,
        attempts:
          (priorResult?.attempts ??
            (priorResult ? 1 : task.retestCorrection?.attempts ?? 0)) + 1,
        corrected: !!priorResult || !!task.retestCorrection,
        assisted: !!task.retestAssisted || !!priorResult?.assisted,
        repeated,
      };
      task.state =
        task.retestResult.correct && task.practicePassed
          ? "reviewed"
          : "guiding";
      task.trigger = "retest";
      flows.save(req.user!.id, task, "retest", {
        ...task.retestResult,
        question: task.retest,
      });
      res.json({ task });
    } catch (e) {
      fail(res, e);
    }
  });
  router.post("/flow/analyze", requireMatchingAccount, async (req, res) => {
    const userId = req.user!.id;
    let controller: AbortController | undefined,
      timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const lesson = source(req.body);
      assertNoCredentials(req.body.code + "\n" + req.body.stdin + "\n" + String(req.body.answer??""));
      const requestBoundary = learningRequestBoundary(String(req.body.answer??""));
      if(requestBoundary)throw new AccountError(400,requestBoundary);
      if (
        ![
          "entry",
          "practice",
          "discussion",
          "experiment",
          "prediction",
          "prediction_reply",
          "run",
          "answer",
          "retest",
          "study",
        ].includes(req.body.trigger)
      )
        throw new AccountError(400, "学习触发事件无效。");
      let requestedView: TeachingViewContext | undefined;
      if (
        req.body.trigger === "experiment" &&
        (req.body.viewContext?.kind !== "experiment" ||
          typeof req.body.viewContext?.recordId !== "string")
      )
        throw new AccountError(400, "请先运行本课实验，再分析这次结果。");
      if (isViewEvent(req.body.trigger) && req.body.viewContext != null) {
        const raw = req.body.viewContext;
        if (raw.kind === "lesson")
          requestedView = lessonViewContext(lesson, raw);
        else if (raw.kind === "experiment") {
          if (
            raw.experimentId !== errorExperiment(lesson).id ||
            !Number.isSafeInteger(raw.stepIndex) ||
            raw.stepIndex < 0 ||
            (raw.draftCode !== undefined &&
              (typeof raw.draftCode !== "string" ||
                raw.draftCode.length > 24000)) ||
            (raw.draftInput !== undefined &&
              (typeof raw.draftInput !== "string" ||
                raw.draftInput.length > 4000))
          )
            throw new AccountError(400, "错误实验的代码或位置无效。");
          if (raw.recordId !== undefined) {
            const saved =
              typeof raw.recordId === "string" && raw.recordId.length < 100
                ? (store.db
                    .prepare(
                      "SELECT record_json FROM learning_experiments WHERE id=? AND user_id=? AND lesson_id=?",
                    )
                    .get(raw.recordId, userId, lesson.id) as any)
                : null;
            if (!saved)
              throw new AccountError(400, "未找到属于本账户和本课的实验运行。");
            const record = JSON.parse(saved.record_json) as ExperimentRecord;
            if (
              raw.stepIndex >=
              Math.max(1, record.result.trace?.steps.length ?? 0)
            )
              throw new AccountError(400, "实验步骤超出已采集范围。");
          } else if (raw.stepIndex !== 0)
            throw new AccountError(400, "尚未运行的实验没有执行步骤。");
          requestedView = {
            kind: "experiment",
            experimentId: raw.experimentId,
            stepIndex: raw.stepIndex,
            ...(raw.recordId ? { recordId: raw.recordId } : {}),
            ...(raw.draftCode !== undefined
              ? { draftCode: raw.draftCode }
              : {}),
            ...(raw.draftInput !== undefined
              ? { draftInput: raw.draftInput }
              : {}),
          };
        } else if (
          raw.kind === "execution" &&
          typeof raw.attemptId === "string" &&
          raw.attemptId.length < 100 &&
          Number.isSafeInteger(raw.stepIndex) &&
          raw.stepIndex >= 0 &&
          typeof req.body.taskId === "string"
        )
          requestedView = {
            kind: "execution",
            attemptId: raw.attemptId,
            stepIndex: raw.stepIndex,
          };
        else
          throw new AccountError(400, "当前观察位置无效，请重新定位后提问。");
      }
      let task: LearningTask;
      if (
        req.body.trigger === "prediction_reply" &&
        typeof req.body.taskId !== "string"
      )
        throw new AccountError(400, "请回应当前老师提出的预测问题。");
      if (req.body.trigger === "entry") {
        const matching = store.db
          .prepare(
            `SELECT id FROM ai_tasks WHERE user_id=? AND lesson_id=? AND revision=?
           AND json_extract(task_json,'$.missionId') IS ?
           ORDER BY updated_at DESC,rowid DESC LIMIT 1`,
          )
          .get(
            userId,
            lesson.id,
            revisionFor(req.body.code, req.body.stdin),
            activeMissionId(store, userId, lesson.id) ?? null,
          ) as { id: string } | undefined;
        const latest = matching
          ? flows.get(userId, matching.id)
          : flows.latest(userId, lesson.id);
        task =
          latest &&
          latest.revision === revisionFor(req.body.code, req.body.stdin) &&
          latest.missionId === activeMissionId(store, userId, lesson.id)
            ? latest
            : flows.create(userId, lesson.id, req.body.code, req.body.stdin);
        // Opening a restored lesson is read/resume, not a new model invocation.
        if (task.decision) {
          const focus = task.decision.focus,
            scene = buildScene(
              lesson,
              focus?.options ??
                (task.viewContext?.kind === "lesson"
                  ? task.viewContext.options
                  : defaultSceneOptions(lesson)),
            );
          const step =
            focus?.source === "lesson"
              ? scene.steps[(focus.step ?? 0) - 1]
              : undefined;
          if (
            (task.parentTaskId ||
              task.attemptId ||
              task.prediction ||
              task.answers.length ||
              task.introductionVersion === introductionVersion) &&
            !introductionIssue(task, task.decision) &&
            (task.decision.provider==="program"||task.decision.policyVersion===policyVersion) &&
            (task.decision.responseMode !== "prediction" || (readyForPrediction(task) && !task.attemptId)) &&
            (focus?.source !== "lesson" ||
              (step &&
                (!focus.line || focus.line === step.line) &&
                (!focus.sceneId || focus.sceneId === scene.id)))
          ) {
            res.json({ task, cached: true });
            return;
          }
          delete task.decision;
          flows.save(userId, task, "scene_updated");
        }
      } else if (req.body.trigger === "run") {
        const attempt =
          typeof req.body.attemptId === "string"
            ? store.attempt(userId, req.body.attemptId)
            : null;
        if (
          !attempt ||
          attempt.lessonId !== lesson.id ||
          attempt.code !== req.body.code ||
          attempt.stdin !== req.body.stdin
        )
          throw new AccountError(
            409,
            "未找到属于当前代码和输入的真实运行结果。",
          );
        const newest = store.db
          .prepare(
            "SELECT id FROM attempts WHERE user_id=? AND lesson_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1",
          )
          .get(userId, lesson.id) as { id: string } | undefined;
        if (newest?.id !== attempt.result.id)
          throw new AccountError(
            409,
            "已有更新的运行结果，请分析最近一次运行。",
          );
        const latest = flows.latest(userId, lesson.id);
        task =
          latest?.attemptId === attempt.result.id
            ? latest
            : flows.get(
                userId,
                recordFlowRun(
                  store,
                  userId,
                  attempt.code,
                  attempt.stdin,
                  attempt.result,
                ),
              )!;
      } else if (
        req.body.taskId &&
        req.body.trigger === "study" &&
        flows.get(userId, req.body.taskId)?.missionId !==
          activeMissionId(store, userId, lesson.id)
      )
        task = flows.create(userId, lesson.id, req.body.code, req.body.stdin);
      else if (req.body.taskId) task = current(userId, req.body);
      else
        task = flows.create(userId, lesson.id, req.body.code, req.body.stdin);
      if (
        [
          "discussion",
          "experiment",
          "run",
          "entry",
          "practice",
          "prediction_reply",
        ].includes(req.body.trigger)
      ) {
        if (requestedView?.kind === "execution") {
          const attempt = store.attempt(userId, requestedView.attemptId);
          if (
            task.attemptId !== requestedView.attemptId ||
            !attempt ||
            attempt.code !== task.code ||
            attempt.stdin !== task.stdin ||
            attempt.result.trace?.status !== "available" ||
            requestedView.stepIndex >= attempt.result.trace.steps.length
          )
            throw new AccountError(
              400,
              "真实执行位置不属于当前代码，请重新运行或定位后提问。",
            );
        }
        if (requestedView) task.viewContext = requestedView;
        else delete task.viewContext;
      }
      if (req.body.trigger === "prediction_reply") {
        if (
          typeof req.body.answer !== "string" ||
          !req.body.answer.trim() ||
          req.body.answer.length > 1000
        )
          throw new AccountError(400, "请用1000字以内说说你的输出预期。");
        const spoken = req.body.answer.trim();
        if (task.prediction?.spoken === spoken) {
          res.json({ task, cached: true });
          return;
        }
        if (
          task.attemptId ||
          (!task.prediction && task.decision?.responseMode !== "prediction")
        )
          throw new AccountError(
            409,
            "当前不是运行前的输出预测，请接着讨论或先修改代码。",
          );
        const answer = {
          question: task.decision?.question ?? "修改输出预期",
          answer: spoken,
        };
        if (JSON.stringify(task.answers.at(-1)) !== JSON.stringify(answer)) {
          task.answers = [...task.answers, answer].slice(-12);
          flows.save(userId, task, "prediction_reply", answer);
        }
      }
      if (req.body.trigger === "answer") {
        if (
          !task.decision?.question ||
          typeof req.body.answer !== "string" ||
          !req.body.answer.trim() ||
          req.body.answer.length > 500 ||
          task.answers.length >= 8
        )
          throw new AccountError(
            400,
            "请回答当前追问（最多500字，本任务最多8次）。",
          );
        const answer = {
          question: task.decision.question,
          answer: req.body.answer.trim(),
        };
        if (JSON.stringify(task.answers.at(-1)) !== JSON.stringify(answer)) {
          task.answers.push(answer);
          noteFoundationResponse(task, answer.answer);
          flows.save(userId, task, "answer", answer);
        }
      }
      if (req.body.trigger === "discussion") {
        if (
          typeof req.body.answer !== "string" ||
          !req.body.answer.trim() ||
          req.body.answer.length > 1000
        )
          throw new AccountError(400, "请发送1000字以内的学习问题或回答。");
        if (
          !requestedView &&
          !task.attemptId &&
          task.prediction &&
          task.prediction.spoken === req.body.answer.trim() &&
          task.decision?.predictedOutput === task.prediction.value
        ) {
          res.json({ task, cached: true });
          return;
        }
        const answer = {
          question: task.decision?.question ?? "学习讨论",
          answer: req.body.answer.trim(),
          ...(requestedView ? { viewContext: requestedView } : {}),
        };
        if (JSON.stringify(task.answers.at(-1)) !== JSON.stringify(answer)) {
          task.answers = [...task.answers, answer].slice(-12);
          noteFoundationResponse(task, answer.answer);
          flows.save(userId, task, "discussion", answer);
        }
      }
      task.trigger = req.body.trigger;
      if (
        task.trigger === "experiment" &&
        requestedView?.kind === "experiment" &&
        requestedView.recordId
      ) {
        const repeated = store.db
          .prepare(
            "SELECT 1 FROM ai_task_events WHERE task_id=? AND kind='experiment' AND json_extract(payload_json,'$.recordId')=? LIMIT 1",
          )
          .get(task.id, requestedView.recordId);
        if (!repeated) {
          const row = store.db
            .prepare(
              "SELECT record_json FROM learning_experiments WHERE id=? AND user_id=? AND lesson_id=?",
            )
            .get(requestedView.recordId, userId, lesson.id) as any;
          const observed = JSON.parse(row.record_json) as ExperimentRecord;
          flows.save(userId, task, "experiment", {
            recordId: observed.id,
            experimentId: observed.experimentId,
            status: observed.result.status,
            stdout: observed.result.stdout.slice(0, 1400),
          });
        }
      }
      const previous = previousTaskEvidence(store, userId, task);
      const cacheMissionRow = store.db
        .prepare(
          "SELECT mission_json FROM learning_missions WHERE user_id=? AND lesson_id=? AND status='active'",
        )
        .get(userId, lesson.id) as any;
      const cacheMission = cacheMissionRow
        ? JSON.parse(cacheMissionRow.mission_json)
        : null;
      const key = hash({
        // 缓存依赖完整证据而不只是源码：作答、复测、任务与观察位置变化后都需重新分析。
        policyVersion,
        mission: cacheMission?.id ?? null,
        missionReview: cacheMission
          ? courseReviewEvidence(store, userId, cacheMission)
          : null,
        previous,
        availableRetestIds: eligibleRetests(store, userId, lesson).map(
          (test) => test.id,
        ),
        revision: task.revision,
        prediction: task.prediction,
        execution: executionEvidence(
          task.attemptId ? store.attempt(userId, task.attemptId)?.result : null,
        ),
        answers: task.answers,
        retest: task.retestResult,
        study: store.studyRecords(userId)[lesson.id],
        trigger: task.trigger,
        viewContext: task.viewContext ?? null,
      });
      if (task.decision && flows.cached(userId, task.id, key)) {
        res.json({ task, cached: true });
        return;
      }
      if (!aiConfig(userId).key) {
        flows.save(userId, task, "analysis_unavailable");
        res.status(503).json({
          error: "AI尚未配置。本次学习记录已保留，连接后可继续讲解。",
          code: "AI_NOT_CONFIGURED",
          task,
        });
        return;
      }
      if (!active.has(userId) && active.size >= 3)
        throw new AccountError(429, "AI正在分析，请稍后再试。");
      const now = Date.now();
      for (const [id, item] of usage) if (item.reset < now) usage.delete(id);
      const budget = usage.get(userId) ?? { count: 0, reset: now + 600000 };
      if (budget.count >= 30)
        throw new AccountError(429, "十分钟内已分析30次，请稍后继续。");
      budget.count++;
      usage.set(userId, budget);
      active.get(userId)?.abort();
      controller = new AbortController();
      active.set(userId, controller);
      const c = controller;
      res.on("close", () => {
        if (!res.writableEnded) c.abort();
      });
      timer = setTimeout(() => c.abort(), 45000);
      const before = task.updatedAt;
      const decision = await decide(userId, lesson, task, store, c, previous);
      if (c.signal.aborted) return;
      const latest = flows.get(userId, task.id);
      // 等待模型期间学生可能继续操作；证据已更新时不能把过时讲解写回当前任务。
      if (!latest || latest.updatedAt !== before)
        throw new AccountError(409, "分析期间学习证据已更新，请重新分析。");
      if (
        task.retest &&
        !task.retestResult?.correct &&
        (isViewEvent(task.trigger) || !task.retestResult)
      )
        task.retestAssisted = true;
      task.decision = decision;
      noteFoundationExplanation(task, decision);
      if (
        (task.trigger === "prediction_reply" ||
          task.trigger === "discussion") &&
        decision.predictedOutput !== undefined
      ) {
        task.prediction = {
          kind: "output",
          value: decision.predictedOutput,
          spoken: task.answers.at(-1)!.answer,
        };
        flows.save(userId, task, "prediction", task.prediction);
      }
      if (
        task.trigger === "entry" &&
        !task.parentTaskId &&
        !task.attemptId &&
        !task.prediction &&
        !task.answers.length
      )
        task.introductionVersion = introductionVersion;
      if (decision.action === "retest" && task.attemptId) {
        task.retest = publicRetest(
          retestsFor(lesson).find((r) => r.id === decision.retestId)!,
        );
        task.state = "retesting";
      } else
        task.state =
          task.retestResult?.correct && task.practicePassed
            ? "reviewed"
            : "guiding";
      flows.save(userId, task, "decision", decision, key);
      res.json({ task, cached: false });
    } catch (e) {
      if (!res.destroyed)
        fail(
          res,
          controller?.signal.aborted
            ? new AccountError(504, "分析已停止或超时，学习证据已保留。")
            : e,
        );
    } finally {
      if (timer) clearTimeout(timer);
      if (controller && active.get(userId) === controller)
        active.delete(userId);
    }
  });
  router.post("/flow/retest/start", requireMatchingAccount, (req, res) => {
    try {
      const lesson = source(req.body),
        task = current(req.user!.id, req.body);
      if (!task.attemptId || !task.decision)
        throw new AccountError(409, "请先完成一次运行分析。");
      if (!store.attempt(req.user!.id, task.attemptId)?.result.passed)
        throw new AccountError(
          409,
          "请先修正当前编码任务并运行通过，再进行迁移复测。",
        );
      if (!task.retest) {
        const next = eligibleRetests(store, req.user!.id, lesson)[0];
        if (!next)
          throw new AccountError(
            409,
            "本课现有独立复测已做过，可结合后续课程继续练习；不把重复答题算作新证据。",
          );
        task.retest = publicRetest(next);
      }
      task.state = "retesting";
      flows.save(req.user!.id, task, "retest_start");
      res.json({ task });
    } catch (e) {
      fail(res, e);
    }
  });
  return router;
}
