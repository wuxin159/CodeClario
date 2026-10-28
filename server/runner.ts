import { spawn, execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { AccountError } from "./database.ts";
export const runnerImage =
  process.env.RUNNER_IMAGE || "codewise-runner:teaching-v2";
let activeRuns = 0;
export async function runSandbox(request: {
  language: string;
  code: string;
  stdin: string;
  tests: { input: string; expected: string }[];
  functionCheck?: boolean;
}): Promise<Record<string, any>> {
  if (activeRuns >= 3)
    throw new AccountError(429, "运行队列繁忙，请稍后再试。");
  activeRuns++;
  const container = "codewise-" + randomUUID();
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(
        "docker",
        [
          "run",
          "--rm",
          "-i",
          "--name",
          container,
          "--network",
          "none",
          "--read-only",
          "--memory",
          "256m",
          "--cpus",
          "1",
          "--pids-limit",
          "32",
          "--cap-drop",
          "ALL",
          "--security-opt",
          "no-new-privileges",
          "--tmpfs",
          "/work:rw,exec,size=20m,mode=1777",
          runnerImage,
        ],
        { windowsHide: true },
      );
      let out = "",
        err = "",
        overLimit = false;
      const cleanup = () => {
        child.kill();
        execFile(
          "docker",
          ["rm", "-f", container],
          { windowsHide: true },
          () => {},
        );
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new AccountError(503, "运行超时，请检查循环是否能结束。"));
      }, 35000);
      child.stdout.on("data", (b) => {
        out += b;
        if (out.length > 500000) {
          overLimit = true;
          cleanup();
        }
      });
      child.stderr.on("data", (b) => {
        if (err.length < 4000) err += b;
      });
      child.on("error", () => {
        clearTimeout(timer);
        reject(new AccountError(503, "代码运行服务暂不可用。"));
      });
      child.on("close", (status) => {
        clearTimeout(timer);
        if (overLimit) {
          reject(
            new AccountError(413, "执行记录或输出过大，请缩小输入或循环范围。"),
          );
          return;
        }
        if (status !== 0) {
          reject(
            new AccountError(
              503,
              /Unable to find image|No such image/.test(err)
                ? "代码运行器尚未准备好。"
                : "运行服务暂不可用，请稍后重试。",
            ),
          );
          return;
        }
        try {
          resolve(JSON.parse(out));
        } catch {
          reject(new AccountError(503, "运行记录未能完整读取。"));
        }
      });
      child.stdin.on("error", () => {});
      child.stdin.end(JSON.stringify(request));
    });
  } finally {
    activeRuns--;
  }
}
