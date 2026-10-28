import "dotenv/config";
import express from "express";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID, createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findLesson, type RunResult } from "../shared/curriculum.ts";
import { coachingHandler } from "./coaching.ts";
import { AccountError, LearningDatabase } from "./database.ts";
import { accountRoutes, requireMatchingAccount } from "./accounts.ts";
import { aiConfig, aiSettingsRoutes } from "./ai.ts";
import { flowRoutes, recordFlowRun, recordFlowStudy } from "./flow.ts";
import { missionRoutes } from "./missions.ts";
import { dailyRoutes } from "./daily.ts";
import { runSandbox, runnerImage } from "./runner.ts";
import { experimentRoutes } from "./experiments.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const store = new LearningDatabase(
  path.resolve(root, process.env.DATABASE_PATH || "../Data/learning.sqlite"),
);
await store.provisionInitialAccount(
  process.env.BOOTSTRAP_USERNAME,
  process.env.BOOTSTRAP_PASSWORD,
  process.env.BOOTSTRAP_DISPLAY_NAME,
);
const app = express();
const runFile = promisify(execFile);
const image = runnerImage;

app.disable("x-powered-by");
if (process.env.TRUST_PROXY === "loopback") app.set("trust proxy", "loopback");
app.use(express.json({ limit: "640kb" }));
app.use("/api", (req, res, next) => {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin && new URL(origin).host !== host) {
    res.status(403).json({ error: "请从本网站发起请求。" });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.use(
  "/api",
  accountRoutes(store, (userId, lessonId) =>
    recordFlowStudy(store, userId, lessonId),
  ),
);
app.use("/api", aiSettingsRoutes());
app.use("/api", flowRoutes(store));
app.use("/api", missionRoutes(store));
app.use("/api", dailyRoutes(store));
app.use("/api", experimentRoutes(store));

app.get("/api/status", async (req, res) => {
  let runner = false;
  try {
    await runFile(
      "docker",
      ["image", "inspect", image, "--format", "{{.Id}}"],
      { timeout: 4000 },
    );
    runner = true;
  } catch {
    /* explicitly reported */
  }
  res.json({
    runner,
    ai: Boolean(aiConfig(req.user?.id).key),
    languages: ["c", "cpp", "python"],
    model: process.env.DEEPSEEK_MODEL || "deepseek-flash",
  });
});

app.post("/api/run", requireMatchingAccount, async (req, res) => {
  const { lessonId, code, stdin = "" } = req.body;
  const lesson =
    typeof lessonId === "string" ? findLesson(lessonId) : undefined;
  if (
    !lesson ||
    typeof code !== "string" ||
    code.length > 24000 ||
    typeof stdin !== "string" ||
    stdin.length > 4000
  ) {
    res
      .status(400)
      .json({ error: "请选择课程，并提交不超过 24,000 字符的代码。" });
    return;
  }
  const tests =
    lesson.tests ??
    (lesson.index === 2
      ? [
          { input: "17", expected: "minor" },
          { input: "18", expected: "adult" },
          { input: "20", expected: "adult" },
        ]
      : lesson.index === 5
        ? [3, 0, -4, 7].map((n) => ({
            input: String(n),
            expected: String(n * n),
          }))
        : [{ input: lesson.stdin, expected: lesson.expected }]);
  try {
    const result = await runSandbox({
      language: lesson.language,
      code,
      stdin,
      tests,
      functionCheck: lesson.index === 5,
    });
    const actual = String(result.stdout || "");
    const checkedTests =
      Array.isArray(result.tests) && result.tests.length
        ? (result.tests as RunResult["tests"])
        : tests.map((test) => ({ ...test, actual, passed: false }));
    const passed =
      result.status === "success" && checkedTests.every((test) => test.passed);
    const output: RunResult = {
      id: randomUUID(),
      revision: createHash("sha256")
        .update(code + "\0" + stdin)
        .digest("hex")
        .slice(0, 16),
      lessonId,
      status: String(result.status || "error"),
      stdout: actual,
      stderr: String(result.stderr || ""),
      compileOutput: String(result.compileOutput || ""),
      exitCode: Number(result.exitCode ?? -1),
      durationMs: Number(result.durationMs || 0),
      passed,
      tests: checkedTests,
      trace:
        result.trace && !Array.isArray(result.trace)
          ? (result.trace as RunResult["trace"])
          : {
              status: "unavailable",
              reason: "本次没有可用执行轨迹。",
              steps: [],
            },
    };
    store.saveAttempt(req.user!.id, code, stdin, output);
    recordFlowRun(store, req.user!.id, code, stdin, output);
    res.json(output);
  } catch (error) {
    res
      .status(error instanceof AccountError ? error.status : 503)
      .json({ error: (error as Error).message });
  }
});

app.post("/api/coach", requireMatchingAccount, coachingHandler(store));

const staticRoot = path.resolve(root, process.env.STATIC_DIR || "dist");
if (process.argv.includes("--production")) app.use(express.static(staticRoot));
else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    root,
    server: {
      middlewareMode: true,
      host: "127.0.0.1",
      hmr: {
        host: "127.0.0.1",
        port: Number(process.env.PORT || 3000) + 10000,
      },
    },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
if (process.argv.includes("--production"))
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.join(staticRoot, "index.html")),
  );
app.use(
  (
    error: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    res.status(error instanceof AccountError ? error.status : 400).json({
      error:
        error instanceof AccountError
          ? error.message
          : "请求内容无法处理，请检查后重试。",
    });
  },
);
const port = Number(process.env.PORT || 3000);
app.listen(port, process.env.HOST || "127.0.0.1", () =>
  console.log(
    `Learning platform ready: http://127.0.0.1:${port} | AI ${process.env.DEEPSEEK_API_KEY ? "configured" : "course hints"}`,
  ),
);
