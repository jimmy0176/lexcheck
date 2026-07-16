"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const inputCls = "h-10 w-full rounded-md border bg-background px-3 text-sm";

type Tab = "login" | "register";

export function PhoneCodeLoginForm({
  onSuccess,
}: {
  onSuccess: (user: { id: string; role: string; isAdmin: boolean; name: string | null; companyName: string | null }) => void;
}) {
  const [tab, setTab] = useState<Tab>("login");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function switchTab(next: Tab) {
    setTab(next);
    setErr(null);
    setNotice(null);
  }

  async function requestCode() {
    setErr(null);
    setNotice(null);
    setCodeBusy(true);
    try {
      const res = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const json = (await res.json()) as { ok?: boolean; isNewPhone?: boolean; message?: string };
      if (!res.ok || !json.ok) throw new Error(json.message ?? "获取验证码失败");
      const isNewPhone = Boolean(json.isNewPhone);

      if (tab === "login" && isNewPhone) {
        setTab("register");
        setNotice("该账号尚未注册，已为你切换到注册，请重新获取验证码");
        return;
      }
      if (tab === "register" && !isNewPhone) {
        setTab("login");
        setNotice("该账号已注册，已为你切换到登录，请重新获取验证码");
        return;
      }
      setNotice("验证码已获取，请填写后继续");
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setCodeBusy(false);
    }
  }

  async function submit() {
    setErr(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code, name, companyName, inviteCode }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        user?: { id: string; role: string; isAdmin: boolean; name: string | null; companyName: string | null };
        message?: string;
      };
      if (!res.ok || !json.ok || !json.user) throw new Error(json.message ?? (tab === "register" ? "注册失败" : "登录失败"));
      onSuccess(json.user);
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    phone.trim() && code.trim() && (tab === "login" || (name.trim() && companyName.trim()));

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-md bg-muted p-1 text-sm">
        <button
          type="button"
          onClick={() => switchTab("login")}
          className={`flex-1 rounded-sm py-1.5 font-medium transition-colors ${
            tab === "login" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          登录
        </button>
        <button
          type="button"
          onClick={() => switchTab("register")}
          className={`flex-1 rounded-sm py-1.5 font-medium transition-colors ${
            tab === "register" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          注册
        </button>
      </div>

      <label className="block space-y-1">
        <span className="text-sm text-muted-foreground">账号</span>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="请输入手机号"
          inputMode="numeric"
          className={inputCls}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm text-muted-foreground">验证码</span>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="请输入验证码"
            inputMode="numeric"
            className={inputCls}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 shrink-0 px-3"
            onClick={() => void requestCode()}
            disabled={codeBusy || !phone.trim()}
          >
            {codeBusy ? "请求中…" : "获取验证码"}
          </Button>
        </div>
      </label>

      {tab === "register" ? (
        <>
          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">姓名</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">公司名称</span>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputCls} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">邀请码（如未开放自由注册需填写）</span>
            <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} className={inputCls} />
          </label>
        </>
      ) : null}

      <Button type="button" className="w-full" onClick={() => void submit()} disabled={busy || !canSubmit}>
        {busy ? "处理中…" : tab === "register" ? "注册并登录" : "登录"}
      </Button>

      {notice ? <div className="text-sm text-muted-foreground">{notice}</div> : null}
      {err ? <div className="text-sm text-destructive">{err}</div> : null}
    </div>
  );
}
