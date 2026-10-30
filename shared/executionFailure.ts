import type { RunResult } from "./curriculum.ts";

export function executionInterruption(result?: RunResult | null) {
  // 兼容旧记录的负退出码和空编译诊断；终止信号不能单独证明超内存或代码语法有错。
  if (!result) return null;
  const compiling = result.failure?.phase === "compile" || result.status.startsWith("compile_");
  const timedOut = result.failure?.kind === "timeout" || result.timedOut || result.status === "compile_timeout" || result.status === "timeout";
  const terminated = result.failure?.kind === "terminated" || result.status === "compile_terminated" || result.exitCode < 0;
  const noCompileDiagnostic = result.status === "compile_error" && !result.compileOutput.trim() && !result.stderr.trim();
  if (!timedOut && !terminated && !noCompileDiagnostic) return null;
  return compiling
    ? timedOut
      ? "编译超过等待时限，尚未得到可执行程序。请先用相同代码重试；这次结果不能说明代码有语法错误。"
      : "编译未能完成，尚无足够诊断确定原因。请先用相同代码重试；不能仅凭终止结果判定语法错误或内存不足。"
    : timedOut
      ? "程序运行超过等待时限。请检查输入和循环是否能结束，再运行验证。"
      : "程序运行被终止，具体原因尚未确定。可能涉及资源限制，请缩小输入或循环范围后重试。";
}
