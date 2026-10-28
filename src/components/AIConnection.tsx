import { useState } from "react";
import { Settings2 } from "lucide-react";
export default function AIConnection({
  userId,
  onSaved,
  onRequireAuth,
}: {
  userId?: string;
  onSaved: () => void;
  onRequireAuth: () => void;
}) {
  const [open, setOpen] = useState(false),
    [key, setKey] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <details
      className="ai-connection"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>
        <Settings2 size={14} />
        AI连接设置
      </summary>
      {!userId ? (
        <button onClick={onRequireAuth}>登录后连接AI</button>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const r = await fetch("/api/ai/config", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, key, verify: true }),
              });
              const d = await r.json();
              if (!r.ok) throw new Error(d.error);
              setKey("");
              setOpen(false);
              onSaved();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            DeepSeek API Key
            <input
              aria-label="DeepSeek API Key"
              type="password"
              autoComplete="off"
              required
              maxLength={256}
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </label>
          <small>仅保留在服务内存中。</small>
          <button disabled={busy || !key.trim()}>
            {busy ? "正在验证…" : "验证并保存"}
          </button>
          {error && <p role="alert">{error}</p>}
        </form>
      )}
    </details>
  );
}
