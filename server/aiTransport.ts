// 只清理模型常见的 JSON 外壳，不执行返回内容；字段与教学动作仍由业务层校验。
export function parseAIJSON(content: unknown) {
  if (typeof content !== "string")
    throw new Error("AI未返回完整的结构化内容。");
  return JSON.parse(
    content
      .trim()
      .replace(/^\uFEFF/, "")
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, ""),
  );
}
export async function fetchAI(
  url: string,
  init: RequestInit,
): Promise<Response> {
  // 将响应体也纳入有限重试，覆盖“收到响应头后断流”；取消信号仍必须立即生效。
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, init),
        bytes = await response.arrayBuffer();
      if (attempt < 2 && (response.status === 429 || response.status >= 500)) {
        await new Promise((r) =>
          setTimeout(r, Math.min(1200, 250 * (attempt + 1))),
        );
        continue;
      }
      return new Response(bytes, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (error) {
      if (init.signal?.aborted) {
        if (init.signal.reason?.name === "TimeoutError")
          throw new Error("AI响应超时，已有记录已保存，可以稍后重试。");
        throw error;
      }
      if (attempt === 2)
        throw new Error(
          "AI连接暂时中断，已有代码、运行和作答记录已保存，请稍后重试。",
        );
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
  }
  throw new Error("AI暂未完成请求，请重试。");
}
