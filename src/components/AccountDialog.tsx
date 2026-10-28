import { useEffect, useRef, useState, type FormEvent } from "react";
import BrandIdentity from './BrandIdentity';
import {
  ArrowRight,
  BookOpen,
  Eye,
  EyeOff,
  LoaderCircle,
  LogOut,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import type { PublicUser } from "../../shared/account";

type AccountActions = {
  authenticate: (
    mode: "login" | "register",
    values: { username: string; password: string; displayName?: string },
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (displayName: string) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
};
export default function AccountDialog({
  user,
  initialMode,
  reason,
  actions,
  onClose,
  onSuccess,
}: {
  user: PublicUser | null;
  initialMode: "login" | "register" | "profile";
  reason?: string;
  actions: AccountActions;
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const [mode, setMode] = useState(initialMode);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [changePassword, setChangePassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onClose();
      }
      if (event.key === "Tab") {
        const elements = Array.from(
          dialog.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),[tabindex="0"]',
          ) ?? [],
        ).filter((element) => element.getClientRects().length > 0);
        const first = elements[0],
          last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, [busy, onClose]);
  function switchMode(next: typeof mode) {
    setMode(next);
    setError("");
    setPassword("");
    setConfirmation("");
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if ((mode === "register" || changePassword) && password !== confirmation) {
      setError("两次输入的密码不一致。");
      return;
    }
    setBusy(true);
    try {
      if (user && mode === "profile") {
        if (changePassword) {
          await actions.changePassword(currentPassword, password);
          setCurrentPassword("");
          setPassword("");
          setConfirmation("");
          setChangePassword(false);
          onSuccess("密码已修改，其他登录会话已退出。");
        } else {
          await actions.updateProfile(displayName);
          onSuccess("账户信息已更新。");
        }
      } else {
        await actions.authenticate(mode === "register" ? "register" : "login", {
          username,
          password,
          displayName,
        });
        onSuccess(mode === "register" ? "注册成功。" : "已登录。");
        onClose();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError("");
    try {
      await actions.logout();
      onSuccess("已退出登录。");
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="modal-overlay account-overlay"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <section
        data-ui
        ref={dialog}
        className="account-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={
          user ? "账户设置" : mode === "register" ? "注册账户" : "登录账户"
        }
        onClick={(event) => event.stopPropagation()}
      >
        <button
          className="icon-button modal-close"
          aria-label="关闭账户窗口"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <div className="account-heading">
          <BrandIdentity />
        </div>
        <h2>
          {user
            ? "账户设置"
            : mode === "register"
              ? "创建学习账户"
              : "登录你的账户"}
        </h2>
        {(user || reason) && (
          <p className="account-intro">
            {user ? "管理个人信息和登录密码。" : reason}
          </p>
        )}
        {!user && (
          <div className="auth-tabs">
            <button
              type="button"
              className={mode === "login" ? "selected" : ""}
              disabled={busy}
              onClick={() => switchMode("login")}
            >
              登录
            </button>
            <button
              type="button"
              className={mode === "register" ? "selected" : ""}
              disabled={busy}
              onClick={() => switchMode("register")}
            >
              注册
            </button>
          </div>
        )}
        {user && (
          <div className="account-identity">
            <span className="avatar">
              {user.displayName.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <b>{user.displayName}</b>
              <small>@{user.username}</small>
            </div>
            <span className="account-session">
              <ShieldCheck size={13} />
              已登录
            </span>
          </div>
        )}
        {user && (
          <div className="account-section-tabs">
            <button
              className={!changePassword ? "selected" : ""}
              disabled={busy}
              onClick={() => {
                setChangePassword(false);
                setError("");
              }}
            >
              个人信息
            </button>
            <button
              className={changePassword ? "selected" : ""}
              disabled={busy}
              onClick={() => {
                setChangePassword(true);
                setError("");
              }}
            >
              修改密码
            </button>
          </div>
        )}
        <form onSubmit={submit}>
          {!user && (
            <label className="account-field">
              用户名
              <input
                autoFocus
                name="username"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                minLength={3}
                maxLength={24}
                pattern="[A-Za-z0-9_]+"
                placeholder="3～24 位字母、数字或下划线"
                disabled={busy}
              />
            </label>
          )}
          {((!user && mode === "register") || (user && !changePassword)) && (
            <label className="account-field">
              昵称
              <input
                name="displayName"
                autoComplete="nickname"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                required
                maxLength={32}
                placeholder="学习记录中显示的名字"
                disabled={busy}
              />
            </label>
          )}
          {user && changePassword && (
            <label className="account-field">
              当前密码
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
                maxLength={128}
                disabled={busy}
              />
            </label>
          )}
          {(!user || changePassword) && (
            <label className="account-field">
              {changePassword ? "新密码" : "密码"}
              <span className="password-field">
                <input
                  name="password"
                  aria-label={changePassword ? "新密码" : "密码"}
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    mode === "register" || changePassword
                      ? "new-password"
                      : "current-password"
                  }
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={
                    mode === "register" || changePassword ? 8 : undefined
                  }
                  maxLength={128}
                  placeholder={
                    mode === "register" || changePassword
                      ? "至少 8 位字符"
                      : "输入密码"
                  }
                  disabled={busy}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>
          )}
          {((!user && mode === "register") || changePassword) && (
            <label className="account-field">
              确认密码
              <input
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                required
                minLength={8}
                maxLength={128}
                placeholder="再次输入密码"
                disabled={busy}
              />
            </label>
          )}
          {error && (
            <div className="account-error" role="alert">
              {error}
            </div>
          )}
          <button className="button primary account-submit" disabled={busy}>
            {busy ? <LoaderCircle size={16} className="spin" /> : null}
            {busy
              ? "正在处理…"
              : user
                ? changePassword
                  ? "更新密码"
                  : "保存修改"
                : mode === "register"
                  ? "注册并登录"
                  : "登录"}
            {!busy && <ArrowRight size={16} />}
          </button>
        </form>
        {user ? (
          <button className="logout-button" onClick={logout} disabled={busy}>
            <LogOut size={15} />
            退出登录
          </button>
        ) : (
          <div className="account-footnote">
            <ShieldCheck size={14} />
            你的代码与学习记录仅当前账户可见。
          </div>
        )}
      </section>
    </div>
  );
}
