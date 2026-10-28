import { Router } from "express";
import { requireAccount, requireMatchingAccount } from "./accounts.ts";

// Account-specific keys are never persisted or returned to the client.
const keys = new Map<string, string>();
export const aiConfig = (userId?: string) => ({
  key: (userId && keys.get(userId)) || process.env.DEEPSEEK_API_KEY || "",
  model: process.env.DEEPSEEK_MODEL || "deepseek-flash",
  base: (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(
    /\/$/,
    "",
  ),
});
export const aiSettingsRoutes = () => {
  const router = Router();
  router.get("/ai/config", requireAccount, (req, res) =>
    res.json({
      configured: !!aiConfig(req.user!.id).key,
      personal: keys.has(req.user!.id),
      model: aiConfig().model,
    }),
  );
  router.put("/ai/config", requireMatchingAccount, async (req, res) => {
    const key = req.body.key;
    if (
      typeof key !== "string" ||
      key.trim().length < 12 ||
      key.length > 256 ||
      /\s/.test(key.trim())
    ) {
      res.status(400).json({ error: "请输入有效的 DeepSeek API Key。" });
      return;
    }
    if (req.body.verify === true) {
      try {
        const response = await fetch(aiConfig().base + "/models", {
          headers: { Authorization: `Bearer ${key.trim()}` },
          signal: AbortSignal.timeout(12000),
        });
        if (!response.ok) {
          res
            .status(502)
            .json({
              error:
                response.status === 401
                  ? "密钥认证失败，请检查后重试。"
                  : `AI连接验证失败（${response.status}）。`,
            });
          return;
        }
      } catch {
        res.status(502).json({ error: "暂时无法连接AI服务，密钥尚未保存。" });
        return;
      }
    }
    keys.set(req.user!.id, key.trim());
    res.json({ configured: true, personal: true, model: aiConfig().model });
  });
  router.delete("/ai/config", requireMatchingAccount, (req, res) => {
    keys.delete(req.user!.id);
    res.json({ configured: !!aiConfig(req.user!.id).key, personal: false });
  });
  return router;
};
