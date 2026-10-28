import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { findLesson, lessons, type RunResult } from "../shared/curriculum.ts";
import {
  teachingPlan,
  type StudyEvent,
  type StudyRecord,
} from "../shared/teaching.ts";
import {
  emptyLearningState,
  type PublicUser,
  type LearningState,
} from "../shared/account.ts";

type UserRow = {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  password_salt: string;
  last_lesson: string;
};
let activeHashes = 0;
const passwordOptions = { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 };
const publicUser = (row: UserRow): PublicUser => ({
  id: row.id,
  username: row.username,
  displayName: row.display_name,
});
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export class AccountError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function checkPassword(password: unknown): asserts password is string {
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 128
  )
    throw new AccountError(400, "密码长度应为 8～128 位。");
}
async function hashPassword(password: string, salt: string): Promise<Buffer> {
  if (activeHashes >= 2)
    throw new AccountError(429, "账户服务繁忙，请稍后重试。");
  activeHashes++;
  return new Promise((resolve, reject) =>
    scrypt(password, salt, 64, passwordOptions, (error, key) => {
      activeHashes--;
      if (error) reject(error);
      else resolve(key);
    }),
  );
}
async function verifyPassword(
  password: string,
  row?: UserRow,
): Promise<boolean> {
  const actual = await hashPassword(
    password,
    row?.password_salt ?? "account-not-found-dummy-salt",
  );
  const expected = row
    ? Buffer.from(row.password_hash, "hex")
    : Buffer.alloc(64);
  return timingSafeEqual(actual, expected) && Boolean(row);
}

export class LearningDatabase {
  readonly db: DatabaseSync;
  constructor(readonly filename: string) {
    mkdirSync(path.dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec(
      "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
    );
    const version = (this.db.prepare("PRAGMA user_version").get() as any)
      .user_version;
    if (version > 6)
      throw new Error("数据库版本高于当前程序版本，停止启动以保护数据。");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        display_name TEXT NOT NULL, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL,
        last_lesson TEXT NOT NULL DEFAULT 'c-1', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS drafts (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lesson_id TEXT NOT NULL, code TEXT NOT NULL, stdin TEXT NOT NULL,
        updated_at INTEGER NOT NULL, PRIMARY KEY(user_id, lesson_id)
      );
      CREATE TABLE IF NOT EXISTS attempts (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lesson_id TEXT NOT NULL, code TEXT NOT NULL, stdin TEXT NOT NULL,
        result_json TEXT NOT NULL, passed INTEGER NOT NULL, duration_ms INTEGER NOT NULL,
        date TEXT NOT NULL, created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS attempts_by_user_time ON attempts(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS session_expiry ON sessions(expires_at);
      CREATE TABLE IF NOT EXISTS coach_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lesson_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL,
        provider TEXT, tools_json TEXT NOT NULL DEFAULT '[]', skill TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS messages_by_user_lesson ON coach_messages(user_id,lesson_id,id);
      CREATE TABLE IF NOT EXISTS learning_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lesson_id TEXT NOT NULL, lesson_version TEXT NOT NULL,
        kind TEXT NOT NULL, answer INTEGER, correct INTEGER, level INTEGER, created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS events_by_user_lesson ON learning_events(user_id,lesson_id,id);
    `);
    if (
      !(
        this.db.prepare("PRAGMA table_info(coach_messages)").all() as any[]
      ).some((row) => row.name === "context_json")
    )
      this.db.exec(
        "ALTER TABLE coach_messages ADD COLUMN context_json TEXT NOT NULL DEFAULT '{}'",
      );
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ai_tasks (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lesson_id TEXT NOT NULL, revision TEXT NOT NULL, task_json TEXT NOT NULL,
        evidence_key TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ai_tasks_by_user_lesson ON ai_tasks(user_id,lesson_id,updated_at DESC);
      CREATE TABLE IF NOT EXISTS ai_task_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL REFERENCES ai_tasks(id) ON DELETE CASCADE,
        kind TEXT NOT NULL, payload_json TEXT NOT NULL, created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS learning_missions (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lesson_id TEXT NOT NULL, status TEXT NOT NULL, mission_json TEXT NOT NULL, created_at INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS mission_active_user ON learning_missions(user_id) WHERE status='active';
      CREATE INDEX IF NOT EXISTS missions_user_time ON learning_missions(user_id,created_at DESC);
      CREATE TABLE IF NOT EXISTS mission_decisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, mission_id TEXT NOT NULL REFERENCES learning_missions(id),
        user_id TEXT NOT NULL REFERENCES users(id), inputs_json TEXT NOT NULL, decision_json TEXT NOT NULL, created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS daily_learning_plans (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        local_day TEXT NOT NULL, plan_json TEXT NOT NULL, updated_at INTEGER NOT NULL,
        PRIMARY KEY(user_id,local_day)
      );
      CREATE TABLE IF NOT EXISTS learning_experiments (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lesson_id TEXT NOT NULL, record_json TEXT NOT NULL, created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS experiment_owner ON learning_experiments(user_id,lesson_id,created_at);
      PRAGMA user_version=6;
    `);
  }
  async register(
    username: unknown,
    displayName: unknown,
    password: unknown,
    trustedBootstrap = false,
  ): Promise<PublicUser> {
    if (typeof username !== "string" || !/^[A-Za-z0-9_]{3,24}$/.test(username))
      throw new AccountError(400, "用户名需要 3～24 位字母、数字或下划线。");
    if (
      typeof displayName !== "string" ||
      !displayName.trim() ||
      displayName.trim().length > 32
    )
      throw new AccountError(400, "昵称需要 1～32 个字符。");
    if (trustedBootstrap) {
      if (typeof password !== "string" || !password || password.length > 128)
        throw new AccountError(400, "初始账户密码无效。");
    } else checkPassword(password);
    const normalized = username.toLowerCase();
    if (
      this.db.prepare("SELECT id FROM users WHERE username=?").get(normalized)
    )
      throw new AccountError(409, "这个用户名已被使用，请换一个。");
    const salt = randomBytes(16).toString("hex");
    const hash = (await hashPassword(password, salt)).toString("hex");
    const id = randomUUID(),
      now = Date.now();
    try {
      this.db
        .prepare(
          "INSERT INTO users(id,username,display_name,password_hash,password_salt,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
        )
        .run(id, normalized, displayName.trim(), hash, salt, now, now);
    } catch (error) {
      if (String(error).includes("UNIQUE"))
        throw new AccountError(409, "这个用户名已被使用，请换一个。");
      throw error;
    }
    return { id, username: normalized, displayName: displayName.trim() };
  }
  async provisionInitialAccount(
    username?: string,
    password?: string,
    displayName?: string,
  ) {
    if (!username || !password) return;
    if (
      this.db
        .prepare("SELECT id FROM users WHERE username=?")
        .get(username.toLowerCase())
    )
      return;
    await this.register(username, displayName || username, password, true);
  }
  async login(username: unknown, password: unknown): Promise<PublicUser> {
    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      username.length > 128 ||
      password.length > 128
    )
      throw new AccountError(400, "请输入用户名和密码。");
    const row = this.db
      .prepare("SELECT * FROM users WHERE username=?")
      .get(username.trim().toLowerCase()) as UserRow | undefined;
    if (!(await verifyPassword(password, row)))
      throw new AccountError(401, "用户名或密码不正确。");
    return publicUser(row!);
  }
  createSession(userId: string): string {
    const token = randomBytes(32).toString("base64url");
    this.db
      .prepare("DELETE FROM sessions WHERE expires_at <= ?")
      .run(Date.now());
    this.db
      .prepare(
        "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)",
      )
      .run(digest(token), userId, Date.now() + 7 * 86400000);
    return token;
  }
  sessionUser(token?: string): PublicUser | null {
    if (!token || token.length > 128) return null;
    const row = this.db
      .prepare(
        "SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>?",
      )
      .get(digest(token), Date.now()) as UserRow | undefined;
    return row ? publicUser(row) : null;
  }
  revokeSession(token?: string) {
    if (token)
      this.db
        .prepare("DELETE FROM sessions WHERE token_hash=?")
        .run(digest(token));
  }
  updateProfile(userId: string, displayName: unknown): PublicUser {
    if (
      typeof displayName !== "string" ||
      !displayName.trim() ||
      displayName.trim().length > 32
    )
      throw new AccountError(400, "昵称需要 1～32 个字符。");
    this.db
      .prepare("UPDATE users SET display_name=?,updated_at=? WHERE id=?")
      .run(displayName.trim(), Date.now(), userId);
    return publicUser(
      this.db.prepare("SELECT * FROM users WHERE id=?").get(userId) as UserRow,
    );
  }
  async changePassword(userId: string, current: unknown, next: unknown) {
    checkPassword(next);
    if (typeof current !== "string" || current.length > 128)
      throw new AccountError(400, "请输入当前密码。");
    const row = this.db
      .prepare("SELECT * FROM users WHERE id=?")
      .get(userId) as UserRow;
    if (!(await verifyPassword(current, row)))
      throw new AccountError(400, "当前密码不正确。");
    const salt = randomBytes(16).toString("hex"),
      hash = (await hashPassword(next, salt)).toString("hex");
    this.db.exec("BEGIN");
    try {
      this.db
        .prepare(
          "UPDATE users SET password_hash=?,password_salt=?,updated_at=? WHERE id=?",
        )
        .run(hash, salt, Date.now(), userId);
      this.db.prepare("DELETE FROM sessions WHERE user_id=?").run(userId);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  learningState(userId: string): LearningState {
    const state = emptyLearningState();
    const user = this.db
      .prepare("SELECT last_lesson FROM users WHERE id=?")
      .get(userId) as { last_lesson: string };
    state.lastLesson = user.last_lesson;
    state.study = this.studyRecords(userId);
    state.totals = this.db
      .prepare(
        "SELECT COUNT(*) AS runs, COALESCE(SUM(passed),0) AS passed, COUNT(DISTINCT date) AS activeDays FROM attempts WHERE user_id=?",
      )
      .get(userId) as LearningState["totals"];
    const since = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Singapore",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(Date.now() - 6 * 86400000));
    const activity = this.db
      .prepare(
        "SELECT date,COUNT(*) AS count FROM attempts WHERE user_id=? AND date>=? GROUP BY date",
      )
      .all(userId, since) as { date: string; count: number }[];
    state.activity = Object.fromEntries(
      activity.map((row) => [row.date, row.count]),
    );
    const drafts = this.db
      .prepare("SELECT lesson_id,code,stdin FROM drafts WHERE user_id=?")
      .all(userId) as { lesson_id: string; code: string; stdin: string }[];
    for (const draft of drafts) {
      state.drafts[draft.lesson_id] = draft.code;
      state.inputs[draft.lesson_id] = draft.stdin;
    }
    state.completed = (
      this.db
        .prepare(
          "SELECT DISTINCT lesson_id FROM attempts WHERE user_id=? AND passed=1",
        )
        .all(userId) as { lesson_id: string }[]
    ).map((item) => item.lesson_id);
    state.attempts = (
      this.db
        .prepare(
          "SELECT id,lesson_id,passed,date,duration_ms FROM attempts WHERE user_id=? ORDER BY created_at DESC,rowid DESC LIMIT 500",
        )
        .all(userId) as any[]
    )
      .reverse()
      .map((item) => ({
        id: item.id,
        lessonId: item.lesson_id,
        passed: Boolean(item.passed),
        date: item.date,
        duration: item.duration_ms,
      }));
    return state;
  }
  saveDrafts(userId: string, payload: unknown) {
    const body = payload as any;
    if (
      !body ||
      !Array.isArray(body.drafts) ||
      body.drafts.length > lessons.length ||
      !findLesson(body.lastLesson)
    )
      throw new AccountError(400, "草稿数据格式不正确。");
    for (const item of body.drafts) {
      if (
        !item ||
        !findLesson(item.lessonId) ||
        typeof item.code !== "string" ||
        item.code.length > 24000 ||
        typeof item.stdin !== "string" ||
        item.stdin.length > 4000
      )
        throw new AccountError(400, "课程或代码内容无效，草稿未保存。");
    }
    this.db.exec("BEGIN");
    try {
      const insert = this.db.prepare(
        "INSERT INTO drafts(user_id,lesson_id,code,stdin,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,lesson_id) DO UPDATE SET code=excluded.code,stdin=excluded.stdin,updated_at=excluded.updated_at",
      );
      for (const item of body.drafts)
        insert.run(userId, item.lessonId, item.code, item.stdin, Date.now());
      this.db
        .prepare("UPDATE users SET last_lesson=?,updated_at=? WHERE id=?")
        .run(body.lastLesson, Date.now(), userId);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  saveAttempt(userId: string, code: string, stdin: string, result: RunResult) {
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Singapore",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    this.db.exec("BEGIN");
    try {
      this.db
        .prepare(
          "INSERT INTO attempts(id,user_id,lesson_id,code,stdin,result_json,passed,duration_ms,date,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          result.id,
          userId,
          result.lessonId,
          code,
          stdin,
          JSON.stringify(result),
          Number(result.passed),
          result.durationMs,
          date,
          Date.now(),
        );
      this.db
        .prepare("UPDATE users SET last_lesson=?,updated_at=? WHERE id=?")
        .run(result.lessonId, Date.now(), userId);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  attempt(userId: string, attemptId: string) {
    const row = this.db
      .prepare(
        "SELECT code,stdin,lesson_id,result_json FROM attempts WHERE id=? AND user_id=?",
      )
      .get(attemptId, userId) as
      | { code: string; stdin: string; lesson_id: string; result_json: string }
      | undefined;
    return row
      ? {
          code: row.code,
          stdin: row.stdin,
          lessonId: row.lesson_id,
          result: JSON.parse(row.result_json) as RunResult,
        }
      : null;
  }
  attemptPage(userId: string, cursor?: string) {
    let boundary: { time: number; id: string } | null = null;
    if (cursor) {
      try {
        if (cursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(cursor))
          throw new Error();
        const parsed = JSON.parse(
          Buffer.from(cursor, "base64url").toString("utf8"),
        );
        if (
          !Number.isSafeInteger(parsed.time) ||
          parsed.time < 0 ||
          typeof parsed.id !== "string" ||
          !parsed.id ||
          parsed.id.length > 128
        )
          throw new Error();
        boundary = parsed;
      } catch {
        throw new AccountError(400, "历史分页位置无效，请重新加载。");
      }
    }
    const columns = "id,lesson_id,passed,date,duration_ms,created_at";
    const rows = (
      boundary
        ? this.db
            .prepare(
              `SELECT ${columns} FROM attempts WHERE user_id=? AND (created_at<? OR (created_at=? AND id<?)) ORDER BY created_at DESC,id DESC LIMIT 9`,
            )
            .all(userId, boundary.time, boundary.time, boundary.id)
        : this.db
            .prepare(
              `SELECT ${columns} FROM attempts WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 9`,
            )
            .all(userId)
    ) as any[];
    const page = rows.slice(0, 8),
      last = page.at(-1);
    return {
      items: page.map((row) => ({
        id: row.id,
        lessonId: row.lesson_id,
        passed: Boolean(row.passed),
        date: row.date,
        duration: row.duration_ms,
        createdAt: row.created_at,
      })),
      nextCursor:
        rows.length > 8
          ? Buffer.from(
              JSON.stringify({ time: last.created_at, id: last.id }),
            ).toString("base64url")
          : null,
    };
  }
  studyRecords(userId: string): Record<string, StudyRecord> {
    const result: Record<string, StudyRecord> = {};
    // Fold only the latest answer of each kind, while retaining full event history.
    const rows = this.db
      .prepare(
        `SELECT e.lesson_id,e.kind,e.answer,e.correct FROM learning_events e
      JOIN (SELECT lesson_id,kind,MAX(id) AS id FROM learning_events WHERE user_id=? AND lesson_version='intro-v3' GROUP BY lesson_id,kind) last ON e.id=last.id`,
      )
      .all(userId) as any[];
    for (const row of rows) {
      const record = (result[row.lesson_id] ??= {});
      if (row.kind === "visited") record.visited = true;
      if (row.kind === "prediction" || row.kind === "review")
        record[row.kind as "prediction" | "review"] = {
          answer: row.answer,
          correct: Boolean(row.correct),
        };
    }
    const hints = this.db
      .prepare(
        "SELECT lesson_id,COUNT(*) AS count FROM learning_events WHERE user_id=? AND kind='hint' GROUP BY lesson_id",
      )
      .all(userId) as any[];
    for (const row of hints) (result[row.lesson_id] ??= {}).hints = row.count;
    return result;
  }
  saveStudyEvent(userId: string, input: unknown) {
    const event = input as StudyEvent;
    const lesson =
      typeof event?.lessonId === "string"
        ? findLesson(event.lessonId)
        : undefined;
    if (
      !lesson ||
      !["visited", "prediction", "review", "hint"].includes(event.kind)
    )
      throw new AccountError(400, "学习事件无效。");
    let correct: boolean | null = null;
    if (event.kind === "prediction" || event.kind === "review") {
      const question = teachingPlan(lesson).questions.find(
        (q) => q.id === event.kind,
      )!;
      if (
        !Number.isInteger(event.answer) ||
        event.answer! < 0 ||
        event.answer! >= question.options.length
      )
        throw new AccountError(400, "请选择本题的一个选项。");
      correct = event.answer === question.correct;
    }
    if (
      event.kind === "hint" &&
      (!Number.isInteger(event.level) || event.level! < 1 || event.level! > 3)
    )
      throw new AccountError(400, "提示级别无效。");
    const existing = this.studyRecords(userId)[lesson.id];
    if (event.kind !== "visited" || !existing?.visited)
      this.db
        .prepare(
          "INSERT INTO learning_events(user_id,lesson_id,lesson_version,kind,answer,correct,level,created_at) VALUES(?,?,?,?,?,?,?,?)",
        )
        .run(
          userId,
          lesson.id,
          teachingPlan(lesson).version,
          event.kind,
          event.answer ?? null,
          correct === null ? null : Number(correct),
          event.level ?? null,
          Date.now(),
        );
    return this.studyRecords(userId)[lesson.id] ?? {};
  }
  coachMessages(userId: string, lessonId: string) {
    return (
      this.db
        .prepare(
          "SELECT role,content,provider,tools_json,skill,context_json FROM coach_messages WHERE user_id=? AND lesson_id=? ORDER BY id DESC LIMIT 80",
        )
        .all(userId, lessonId) as any[]
    )
      .reverse()
      .map((row) => ({
        role: row.role,
        content: row.content,
        provider: row.provider || undefined,
        tools: JSON.parse(row.tools_json),
        skill: row.skill || undefined,
        context: JSON.parse(row.context_json),
      }));
  }
  saveCoaching(
    userId: string,
    lessonId: string,
    question: string,
    response: {
      content: string;
      provider: string;
      tools: string[];
      skill: string;
      context?: Record<string, unknown>;
    },
  ) {
    this.db.exec("BEGIN");
    try {
      const insert = this.db.prepare(
        "INSERT INTO coach_messages(user_id,lesson_id,role,content,provider,tools_json,skill,created_at,context_json) VALUES(?,?,?,?,?,?,?,?,?)",
      );
      insert.run(
        userId,
        lessonId,
        "user",
        question,
        null,
        "[]",
        null,
        Date.now(),
        "{}",
      );
      insert.run(
        userId,
        lessonId,
        "assistant",
        response.content,
        response.provider,
        JSON.stringify(response.tools),
        response.skill,
        Date.now(),
        JSON.stringify(response.context ?? {}),
      );
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}
