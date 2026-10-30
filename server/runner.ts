import { spawn, execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { AccountError } from "./database.ts";
export const runnerImage =
  process.env.RUNNER_IMAGE || "codewise-runner:teaching-v2";
const configuredConcurrency = process.env.RUNNER_MAX_CONCURRENT ?? "3";
if (!/^[1-3]$/.test(configuredConcurrency))
  throw new Error("RUNNER_MAX_CONCURRENT必须为1、2或3。");
export const runnerMaxConcurrent = Number(configuredConcurrency);
let activeRuns = 0;
export async function runSandbox(request: {
  language: string;
  code: string;
  stdin: string;
  tests: { input: string; expected: string }[];
  functionCheck?: boolean;
}): Promise<Record<string, any>> {
  // 宿主层先限并发，容器内再限资源；两者共同控制小内存服务器的运行开销。
  if (activeRuns >= runnerMaxConcurrent)
    throw new AccountError(429, "运行队列繁忙，请稍后再试。");
  activeRuns++;
  const container = "codewise-" + randomUUID();
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(
        // 每次运行独立容器且不挂载宿主源码，只有临时 /work 可写，并禁用网络和额外权限。
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
        // 杀掉 Docker 客户端不等于容器已退出，异常路径还需按本次唯一名称清理容器。
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
          // 同时约束轨迹与输出的完整 JSON 大小，防止服务端持续累积无界字符串。
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
    // 任何成功或异常出口都释放名额，避免一次失败把运行队列永久占满。
    activeRuns--;
  }
}
