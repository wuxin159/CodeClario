import { Router } from "express";
import { randomUUID, createHash } from "node:crypto";
import { AccountError, type LearningDatabase } from "./database.ts";
import { requireAccount, requireMatchingAccount } from "./accounts.ts";
import { findLesson, type RunResult } from "../shared/curriculum.ts";
import { errorExperiment } from "../shared/errorExperiments.ts";
import type { ExperimentRecord } from "../shared/experiment.ts";
import { runSandbox } from "./runner.ts";
export function experimentRoutes(store: LearningDatabase) {
  // 实验使用独立表，不写主课程 attempts 或通过状态；所属账户与课程仍由服务端限定。
  const router = Router();
  router.get("/experiments/:lessonId", requireAccount, (req, res, next) => {
    try {
      const lesson = findLesson(String(req.params.lessonId));
      if (!lesson) throw new AccountError(404, "课程不存在。");
      const row = store.db
        .prepare(
          "SELECT record_json FROM learning_experiments WHERE user_id=? AND lesson_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1",
        )
        .get(req.user!.id, lesson.id) as any;
      res.json({
        userId: req.user!.id,
        experiment: errorExperiment(lesson),
        record: row ? JSON.parse(row.record_json) : null,
      });
    } catch (e) {
      next(e);
    }
  });
  router.post(
    "/experiments/run",
    requireMatchingAccount,
    async (req, res, next) => {
      try {
        const lesson = findLesson(req.body.lessonId);
        if (
          !lesson ||
          req.body.experimentId !== errorExperiment(lesson).id ||
          typeof req.body.code !== "string" ||
          req.body.code.length > 24000 ||
          typeof (req.body.stdin ?? "") !== "string" ||
          (req.body.stdin ?? "").length > 4000
        )
          throw new AccountError(400, "请选择本课实验，代码最多24000字符。");
        const code = req.body.code,
          stdin = req.body.stdin ?? "",
          raw = await runSandbox({
            language: lesson.language,
            code,
            stdin,
            tests: [],
          }),
          id = randomUUID();
        const result: RunResult = {
          id,
          lessonId: lesson.id,
          revision: createHash("sha256")
            .update(code + "\0" + stdin)
            .digest("hex")
            .slice(0, 16),
          status: raw.status ?? "error",
          stdout: raw.stdout ?? "",
          stderr: raw.stderr ?? "",
          compileOutput: raw.compileOutput ?? "",
          durationMs: raw.durationMs ?? 0,
          timedOut: raw.timedOut === true,
          ...(raw.failure ? { failure: raw.failure } : {}),
          exitCode: raw.exitCode ?? -1,
          passed: false,
          tests: [],
          trace:
            raw.trace && !Array.isArray(raw.trace)
              ? raw.trace
              : {
                  status: "unavailable",
                  reason: "程序未正常执行时，先查看错误说明。",
                  steps: [],
                },
        };
        const record: ExperimentRecord = {
          id,
          lessonId: lesson.id,
          experimentId: req.body.experimentId,
          code,
          stdin,
          result,
          referenceSeen: !!req.body.referenceSeen,
          createdAt: Date.now(),
        };
        store.db
          .prepare("INSERT INTO learning_experiments VALUES(?,?,?,?,?)")
          .run(
            id,
            req.user!.id,
            lesson.id,
            JSON.stringify(record),
            record.createdAt,
          );
        res.json({ userId: req.user!.id, record });
      } catch (e) {
        next(e);
      }
    },
  );
  return router;
}
