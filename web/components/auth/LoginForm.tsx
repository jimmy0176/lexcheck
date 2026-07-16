"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, KeyRound, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

const inputWrapCls = "relative";
const inputIconCls = "pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#007BFC]";
const inputCls =
  "h-11 w-full appearance-none rounded-lg border border-transparent bg-[#F2F8FF] pl-10 pr-3 text-base outline-none transition-colors focus:border-blue-500 focus:bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/25 dark:bg-blue-500/10";
const plainInputCls =
  "h-10 w-full appearance-none rounded-lg border border-transparent bg-[#F2F8FF] px-3 text-base outline-none transition-colors focus:border-blue-500 focus:bg-background focus:outline-none focus:ring-2 focus:ring-blue-500/25 dark:bg-blue-500/10";

type Tab = "login" | "register";
type AccountKind = "email" | "phone" | "unknown";
type LoginMethod = "code" | "password";

function detectAccountKind(raw: string): AccountKind {
  const v = raw.trim();
  if (!v) return "unknown";
  if (v.includes("@")) return "email";
  if (/^1[3-9]\d{9}$/.test(v)) return "phone";
  return "unknown";
}

/** 长条块按钮：鼠标悬停时光晕跟随指针移动；disabled 只挡点击，不做暗色处理，按钮始终保持正常配色。 */
function GlowBarButton({
  type = "button",
  onClick,
  disabled,
  tone = "solid",
  children,
}: {
  type?: "button" | "submit";
  onClick: () => void;
  disabled?: boolean;
  tone?: "solid" | "outline";
  children: ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLButtonElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }

  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      disabled={disabled}
      className={`group relative h-11 w-full overflow-hidden rounded-lg text-base font-medium transition-transform active:scale-[0.99] disabled:cursor-not-allowed ${
        tone === "solid"
          ? "bg-[#007BFC] text-white shadow-md shadow-blue-500/30 transition-colors duration-300 hover:bg-[#030F59]"
          : "border border-blue-200 bg-background text-blue-600 dark:border-blue-400/30"
      }`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            tone === "solid"
              ? "radial-gradient(200px circle at var(--mx, 50%) var(--my, 50%), rgba(0,123,252,0.55), transparent 70%)"
              : "radial-gradient(200px circle at var(--mx, 50%) var(--my, 50%), rgba(37,99,235,0.18), transparent 70%)",
        }}
      />
      <span className="relative z-10 flex w-full items-center justify-start px-5">{children}</span>
    </button>
  );
}

export function LoginForm({
  onSuccess,
}: {
  onSuccess: (user: { id: string; role: string; isAdmin: boolean; name: string | null; companyName: string | null }) => void;
}) {
  const [tab, setTab] = useState<Tab>("login");

  // 登录：一个账号框，自动识别邮箱/手机号
  const [account, setAccount] = useState("");
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("password");
  const [loginCode, setLoginCode] = useState("");
  const [password, setPassword] = useState("");

  // 注册：邮箱必填，手机号选填
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerCode, setRegisterCode] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [requireInviteCode, setRequireInviteCode] = useState(false);

  const [busy, setBusy] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const accountKind = useMemo(() => detectAccountKind(account), [account]);
  // 手机号只能用验证码；账号框还没输入内容时无法判断类型，此时按登录方式的默认值（密码）来显示，
  // 避免"默认密码登录"在页面刚打开、账号框为空时被误判成手机号验证码界面。
  const showPasswordField = loginMethod === "password" && accountKind !== "phone";

  function switchTab(next: Tab) {
    setTab(next);
    setErr(null);
    setNotice(null);
  }

  async function requestLoginCode() {
    if (accountKind === "unknown") {
      setErr("请输入正确的邮箱或手机号");
      return;
    }
    setErr(null);
    setNotice(null);
    setCodeBusy(true);
    try {
      const res = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountKind === "email" ? { email: account } : { phone: account }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        isNewEmail?: boolean;
        isNewPhone?: boolean;
        requireInviteCode?: boolean;
        message?: string;
      };
      if (!res.ok || !json.ok) throw new Error(json.message ?? "获取验证码失败");
      const isNew = accountKind === "email" ? Boolean(json.isNewEmail) : Boolean(json.isNewPhone);
      if (isNew) {
        setTab("register");
        setRequireInviteCode(Boolean(json.requireInviteCode));
        if (accountKind === "email") setRegisterEmail(account);
        else setRegisterPhone(account);
        setNotice("该账号尚未注册，已为你切换到注册，请补充信息后重新获取验证码");
        return;
      }
      setNotice("验证码已发送，请查收后填写");
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setCodeBusy(false);
    }
  }

  async function requestRegisterCode() {
    const email = registerEmail.trim();
    if (!email) {
      setErr("请先填写邮箱");
      return;
    }
    setErr(null);
    setNotice(null);
    setCodeBusy(true);
    try {
      const res = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        isNewEmail?: boolean;
        requireInviteCode?: boolean;
        message?: string;
      };
      if (!res.ok || !json.ok) throw new Error(json.message ?? "获取验证码失败");
      if (!json.isNewEmail) {
        setTab("login");
        setAccount(email);
        setNotice("该邮箱已注册，已为你切换到登录，请重新获取验证码");
        return;
      }
      setRequireInviteCode(Boolean(json.requireInviteCode));
      setNotice("验证码已发送到邮箱，请查收后填写");
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setCodeBusy(false);
    }
  }

  async function submitLogin() {
    if (accountKind === "unknown") {
      setErr("请输入正确的邮箱或手机号");
      return;
    }
    if (accountKind === "email" && loginMethod === "password" && !password.trim()) {
      setErr("请输入密码");
      return;
    }
    if (!(accountKind === "email" && loginMethod === "password") && !loginCode.trim()) {
      setErr("请输入验证码");
      return;
    }
    setErr(null);
    setNotice(null);
    setBusy(true);
    try {
      const body =
        accountKind === "email" && loginMethod === "password"
          ? { method: "email_password", email: account, password }
          : accountKind === "email"
            ? { method: "email_code", email: account, code: loginCode }
            : { method: "phone_code", phone: account, code: loginCode };
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        user?: { id: string; role: string; isAdmin: boolean; name: string | null; companyName: string | null };
        message?: string;
      };
      if (!res.ok || !json.ok || !json.user) throw new Error(json.message ?? "登录失败");
      onSuccess(json.user);
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  async function submitRegister() {
    if (!registerEmail.trim()) {
      setErr("请填写邮箱");
      return;
    }
    if (!registerCode.trim()) {
      setErr("请填写验证码");
      return;
    }
    if (!name.trim()) {
      setErr("请填写姓名");
      return;
    }
    if (!companyName.trim()) {
      setErr("请填写公司名称");
      return;
    }
    setErr(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "email_code",
          email: registerEmail,
          code: registerCode,
          name,
          companyName,
          phone: registerPhone,
          inviteCode,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        user?: { id: string; role: string; isAdmin: boolean; name: string | null; companyName: string | null };
        message?: string;
      };
      if (!res.ok || !json.ok || !json.user) throw new Error(json.message ?? "注册失败");
      onSuccess(json.user);
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {tab === "login" ? (
        <>
          <div className={inputWrapCls}>
            <Mail className={inputIconCls} aria-hidden />
            <input
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="邮箱或手机号"
              className={inputCls}
            />
          </div>

          {showPasswordField ? (
            <div className={inputWrapCls}>
              <Lock className={inputIconCls} aria-hidden />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="off"
                placeholder="密码"
                className={inputCls}
              />
            </div>
          ) : (
            <div className="flex gap-2">
              <div className={`${inputWrapCls} flex-1`}>
                <KeyRound className={inputIconCls} aria-hidden />
                <input
                  value={loginCode}
                  onChange={(e) => setLoginCode(e.target.value)}
                  placeholder="验证码"
                  inputMode="numeric"
                  className={inputCls}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-11 shrink-0 px-4 text-sm"
                onClick={() => void requestLoginCode()}
                disabled={codeBusy || accountKind === "unknown"}
              >
                {codeBusy ? "发送中…" : "获取验证码"}
              </Button>
            </div>
          )}

          {showPasswordField ? (
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="ml-1 text-sm text-blue-600 hover:underline underline-offset-2"
                onClick={() => {
                  setLoginMethod("code");
                  setErr(null);
                  setNotice(null);
                }}
              >
                验证码登录
              </button>
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground hover:underline underline-offset-2"
                onClick={() => {
                  setLoginMethod("code");
                  setErr(null);
                  setNotice(null);
                }}
              >
                忘记密码？
              </button>
            </div>
          ) : accountKind !== "phone" ? (
            <div className="flex justify-start">
              <button
                type="button"
                className="ml-1 text-sm text-blue-600 hover:underline underline-offset-2"
                onClick={() => {
                  setLoginMethod("password");
                  setErr(null);
                  setNotice(null);
                }}
              >
                密码登录
              </button>
            </div>
          ) : null}

          <GlowBarButton onClick={() => void submitLogin()} disabled={busy}>
            <span className="flex w-full items-center justify-between">
              <span>{busy ? "处理中…" : "登录"}</span>
              <ArrowRight className="h-5 w-5" aria-hidden />
            </span>
          </GlowBarButton>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-sm text-muted-foreground">OR</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <GlowBarButton tone="outline" onClick={() => switchTab("register")}>
            注册企业账户
          </GlowBarButton>
        </>
      ) : (
        <>
          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">邮箱</span>
            <div className="flex gap-2">
              <input
                value={registerEmail}
                onChange={(e) => setRegisterEmail(e.target.value)}
                placeholder="请输入邮箱地址"
                inputMode="email"
                className={plainInputCls}
              />
              <Button
                type="button"
                variant="outline"
                className="h-10 shrink-0 px-3 text-sm"
                onClick={() => void requestRegisterCode()}
                disabled={codeBusy || !registerEmail.trim()}
              >
                {codeBusy ? "请求中…" : "获取验证码"}
              </Button>
            </div>
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">验证码</span>
            <input
              value={registerCode}
              onChange={(e) => setRegisterCode(e.target.value)}
              placeholder="请输入验证码"
              inputMode="numeric"
              className={plainInputCls}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">手机号（选填）</span>
            <input
              value={registerPhone}
              onChange={(e) => setRegisterPhone(e.target.value)}
              inputMode="numeric"
              className={plainInputCls}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">姓名</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={plainInputCls} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">公司名称</span>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={plainInputCls} />
          </label>
          {requireInviteCode ? (
            <label className="block space-y-1">
              <span className="text-sm text-muted-foreground">邀请码</span>
              <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} className={plainInputCls} />
            </label>
          ) : null}

          <GlowBarButton onClick={() => void submitRegister()} disabled={busy}>
            {busy ? "处理中…" : "注册并登录"}
          </GlowBarButton>

          <button
            type="button"
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            onClick={() => switchTab("login")}
          >
            已有账号？返回登录
          </button>
        </>
      )}

      {notice ? <div className="text-sm text-muted-foreground">{notice}</div> : null}
      {err ? <div className="text-sm text-destructive">{err}</div> : null}
    </div>
  );
}
