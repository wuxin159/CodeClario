import { Router, type RequestHandler, type Response } from "express";
import { AccountError, type LearningDatabase } from "./database.ts";
import type { PublicUser } from "../shared/account.ts";
import { findLesson } from "../shared/curriculum.ts";

declare global {
  namespace Express {
    interface Request {
      user?: PublicUser;
      sessionToken?: string;
    }
  }
}
const cookieName = "learning_session";
export const requireAccount: RequestHandler = (req, res, next) => {
  if (!req.user) {
    res.status(401).json({ error: "请先登录，再运行代码或保存学习记录。" });
    return;
  }
  next();
};
export const requireMatchingAccount: RequestHandler = (req, res, next) => {
  // 身份以服务端会话为准；请求中的 userId 只用于发现旧页面仍在提交另一个账户的数据。
  if (!req.user) {
    res.status(401).json({ error: "请先登录。" });
    return;
  }
  if (req.body?.userId !== req.user.id) {
    res.status(409).json({
      error: "账户已在其他页面切换，请刷新后重试。",
      code: "ACCOUNT_CHANGED",
    });
    return;
  }
  next();
};
const cookieOptions = {
  // 禁止脚本读取会话；生产环境启用 Secure，开发环境仍可在本机 HTTP 下验证账户流程。
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.SESSION_SECURE === "true",
  path: "/",
};
function issueSession(store: LearningDatabase, res: Response, userId: string) {
  res.cookie(cookieName, store.createSession(userId), {
    ...cookieOptions,
    maxAge: 7 * 86400000,
  });
}

export function accountRoutes(
  store: LearningDatabase,
  onStudy?: (userId: string, lessonId: string) => void,
) {
  const router = Router();
  router.use((req, _res, next) => {
    const match = req.headers.cookie
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(cookieName + "="));
    req.sessionToken = match?.slice(cookieName.length + 1);
    req.user = store.sessionUser(req.sessionToken) ?? undefined;
    next();
  });
  const attempts = new Map<string, { count: number; resets: number }>();
  const guard: RequestHandler = (req, res, next) => {
    const ip = req.ip || "local",
      now = Date.now();
    for (const [key, item] of attempts)
      if (item.resets < now) attempts.delete(key);
    const current = attempts.get(ip) ?? { count: 0, resets: now + 10 * 60000 };
    if (current.count >= 30) {
      res.setHeader("Retry-After", Math.ceil((current.resets - now) / 1000));
      res.status(429).json({ error: "尝试次数较多，请稍后再试。" });
      return;
    }
    current.count++;
    attempts.set(ip, current);
    next();
  };
  router.get("/auth/me", (req, res) => res.json({ user: req.user ?? null }));
  router.post("/auth/register", guard, async (req, res) => {
    try {
      const user = await store.register(
        req.body.username,
        req.body.displayName,
        req.body.password,
      );
      store.revokeSession(req.sessionToken);
      issueSession(store, res, user.id);
      res.status(201).json({ user, learning: store.learningState(user.id) });
    } catch (error) {
      handleAccountError(error, res);
    }
  });
  router.post("/auth/login", guard, async (req, res) => {
    try {
      const user = await store.login(req.body.username, req.body.password);
      store.revokeSession(req.sessionToken);
      issueSession(store, res, user.id);
      res.json({ user, learning: store.learningState(user.id) });
    } catch (error) {
      handleAccountError(error, res);
    }
  });
  router.post("/auth/logout", requireMatchingAccount, (req, res) => {
    store.revokeSession(req.sessionToken);
    res.clearCookie(cookieName, cookieOptions);
    res.json({ ok: true });
  });
  router.patch("/auth/profile", requireMatchingAccount, (req, res) => {
    try {
      res.json({
        user: store.updateProfile(req.user!.id, req.body.displayName),
      });
    } catch (error) {
      handleAccountError(error, res);
    }
  });
  router.post(
    "/auth/password",
    requireMatchingAccount,
    guard,
    async (req, res) => {
      try {
        await store.changePassword(
          req.user!.id,
          req.body.currentPassword,
          req.body.newPassword,
        );
        issueSession(store, res, req.user!.id);
        res.json({ ok: true });
      } catch (error) {
        handleAccountError(error, res);
      }
    },
  );
  router.get("/learning", requireAccount, (req, res) =>
    res.json({
      userId: req.user!.id,
      state: store.learningState(req.user!.id),
    }),
  );
  router.get("/learning/history", requireAccount, (req, res) => {
    try {
      if (
        req.query.cursor !== undefined &&
        typeof req.query.cursor !== "string"
      )
        throw new AccountError(400, "历史分页位置无效。");
      res.json({
        userId: req.user!.id,
        ...store.attemptPage(
          req.user!.id,
          req.query.cursor as string | undefined,
        ),
      });
    } catch (error) {
      handleAccountError(error, res);
    }
  });
  router.get("/learning/messages/:lessonId", requireAccount, (req, res) => {
    const lessonId = String(req.params.lessonId);
    if (!findLesson(lessonId)) {
      res.status(404).json({ error: "课程不存在。" });
      return;
    }
    res.json({
      userId: req.user!.id,
      messages: store.coachMessages(req.user!.id, lessonId),
    });
  });
  router.put("/learning/drafts", requireMatchingAccount, (req, res) => {
    try {
      store.saveDrafts(req.user!.id, req.body);
      res.json({ ok: true });
    } catch (error) {
      handleAccountError(error, res);
    }
  });
  router.post("/learning/events", requireMatchingAccount, (req, res) => {
    try {
      const study = store.saveStudyEvent(req.user!.id, req.body);
      if (req.body.kind === "prediction" || req.body.kind === "review")
        onStudy?.(req.user!.id, req.body.lessonId);
      res.json({
        userId: req.user!.id,
        study,
      });
    } catch (error) {
      handleAccountError(error, res);
    }
  });
  router.get("/learning/attempts/:id", requireAccount, (req, res) => {
    const attempt = store.attempt(req.user!.id, String(req.params.id));
    if (!attempt) {
      res.status(404).json({ error: "未找到这条练习记录。" });
      return;
    }
    res.json(attempt);
  });
  return router;
}
function handleAccountError(error: unknown, res: Response) {
  res.status(error instanceof AccountError ? error.status : 500).json({
    error:
      error instanceof AccountError
        ? error.message
        : "账户操作未完成，请稍后重试。",
  });
}
