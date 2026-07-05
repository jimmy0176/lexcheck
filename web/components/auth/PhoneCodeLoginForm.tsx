"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const inputCls = "h-10 w-full rounded-md border bg-background px-3 text-sm";

export function PhoneCodeLoginForm({
  onSuccess,
}: {
  onSuccess: (user: { id: string; role: string; isAdmin: boolean; name: string | null; companyName: string | null }) => void;
}) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [isNewPhone, setIsNewPhone] = useState(false);
  const [requireInviteCode, setRequireInviteCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function requestCode() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        isNewPhone?: boolean;
        requireInviteCode?: boolean;
        message?: string;
      };
      if (!res.ok || !json.ok) throw new Error(json.message ?? "获取验证码失败");
      setIsNewPhone(Boolean(json.isNewPhone));
      setRequireInviteCode(Boolean(json.requireInviteCode));
      setStep("code");
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setErr(null);
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
      if (!res.ok || !json.ok || !json.user) throw new Error(json.message ?? "登录失败");
      onSuccess(json.user);
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <label className="space-y-1 block">
        <span className="text-sm text-muted-foreground">手机号</span>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={step === "code"}
          placeholder="请输入手机号"
          inputMode="numeric"
          className={inputCls}
        />
      </label>

      {step === "code" ? (
        <>
          <label className="space-y-1 block">
            <span className="text-sm text-muted-foreground">验证码</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="请输入验证码"
              inputMode="numeric"
              className={inputCls}
            />
          </label>

          {isNewPhone ? (
            <>
              <label className="space-y-1 block">
                <span className="text-sm text-muted-foreground">姓名</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
              </label>
              <label className="space-y-1 block">
                <span className="text-sm text-muted-foreground">公司名称</span>
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className={inputCls}
                />
              </label>
              {requireInviteCode ? (
                <label className="space-y-1 block">
                  <span className="text-sm text-muted-foreground">邀请码</span>
                  <input
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    className={inputCls}
                  />
                </label>
              ) : null}
            </>
          ) : null}

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setStep("phone")} disabled={busy}>
              返回
            </Button>
            <Button type="button" size="sm" onClick={() => void verify()} disabled={busy || !code.trim()}>
              {busy ? "处理中…" : isNewPhone ? "注册并登录" : "登录"}
            </Button>
          </div>
        </>
      ) : (
        <Button type="button" size="sm" onClick={() => void requestCode()} disabled={busy || !phone.trim()}>
          {busy ? "请求中…" : "获取验证码"}
        </Button>
      )}

      {err ? <div className="text-sm text-destructive">{err}</div> : null}
    </div>
  );
}
