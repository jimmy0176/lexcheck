"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const inputCls = "h-10 w-full rounded-md border bg-background px-3 text-sm";
const readOnlyCls = "h-10 w-full rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground";

export function ProfileForm({
  initialName,
  role,
  companyName,
  phone,
  email,
  hasPassword,
}: {
  initialName: string;
  role: string;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  hasPassword: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [currentEmail, setCurrentEmail] = useState(email);
  const [newEmail, setNewEmail] = useState("");
  const [emailStep, setEmailStep] = useState<"idle" | "code-sent">("idle");
  const [emailCode, setEmailCode] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [emailErr, setEmailErr] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !json.ok) throw new Error(json.message ?? "保存失败");
      setMsg("已保存");
      router.refresh();
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  async function requestEmailChange() {
    setEmailBusy(true);
    setEmailMsg(null);
    setEmailErr(null);
    try {
      const res = await fetch("/api/auth/change-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "request", newEmail }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !json.ok) throw new Error(json.message ?? "发送失败");
      setEmailStep("code-sent");
      setEmailMsg("验证码已发送，请查收邮箱");
    } catch (e) {
      setEmailErr(String(e instanceof Error ? e.message : e));
    } finally {
      setEmailBusy(false);
    }
  }

  async function confirmEmailChange() {
    setEmailBusy(true);
    setEmailMsg(null);
    setEmailErr(null);
    try {
      const res = await fetch("/api/auth/change-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "confirm", newEmail, code: emailCode }),
      });
      const json = (await res.json()) as { ok?: boolean; email?: string; message?: string };
      if (!res.ok || !json.ok) throw new Error(json.message ?? "确认失败");
      setCurrentEmail(json.email ?? newEmail);
      setNewEmail("");
      setEmailCode("");
      setEmailStep("idle");
      setEmailMsg("邮箱已更新");
      router.refresh();
    } catch (e) {
      setEmailErr(String(e instanceof Error ? e.message : e));
    } finally {
      setEmailBusy(false);
    }
  }

  async function savePassword() {
    setPwBusy(true);
    setPwMsg(null);
    setPwErr(null);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !json.ok) throw new Error(json.message ?? "保存失败");
      setCurrentPassword("");
      setNewPassword("");
      setPwMsg(hasPassword ? "密码已修改" : "密码已设置");
      router.refresh();
    } catch (e) {
      setPwErr(String(e instanceof Error ? e.message : e));
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm text-muted-foreground">角色</span>
          <input value={role === "lawyer" ? "律师账号" : "客户账号"} disabled className={readOnlyCls} />
        </label>
        {role === "client" ? (
          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">公司名称</span>
            <input value={companyName ?? ""} disabled className={readOnlyCls} />
          </label>
        ) : null}
        <label className="block space-y-1">
          <span className="text-sm text-muted-foreground">手机号（辅助登录方式，可选）</span>
          <input value={phone ?? "未绑定"} disabled className={readOnlyCls} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-muted-foreground">姓名</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </label>

        <Button type="button" size="sm" disabled={busy || !name.trim()} onClick={() => void save()}>
          {busy ? "保存中…" : "保存"}
        </Button>

        {msg ? <div className="text-sm text-muted-foreground">{msg}</div> : null}
        {err ? <div className="text-sm text-destructive">{err}</div> : null}
      </div>

      <div className="space-y-3 border-t pt-6">
        <h2 className="text-sm font-medium">邮箱（主账号标识）</h2>
        <label className="block space-y-1">
          <span className="text-sm text-muted-foreground">当前邮箱</span>
          <input value={currentEmail ?? "未绑定"} disabled className={readOnlyCls} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-muted-foreground">{currentEmail ? "更换为新邮箱" : "绑定邮箱"}</span>
          <input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="name@example.com"
            className={inputCls}
          />
        </label>
        {emailStep === "idle" ? (
          <Button type="button" size="sm" variant="secondary" disabled={emailBusy || !newEmail.trim()} onClick={() => void requestEmailChange()}>
            {emailBusy ? "发送中…" : "发送验证码"}
          </Button>
        ) : (
          <div className="flex items-end gap-2">
            <label className="block flex-1 space-y-1">
              <span className="text-sm text-muted-foreground">验证码</span>
              <input value={emailCode} onChange={(e) => setEmailCode(e.target.value)} className={inputCls} />
            </label>
            <Button type="button" size="sm" disabled={emailBusy || !emailCode.trim()} onClick={() => void confirmEmailChange()}>
              {emailBusy ? "确认中…" : "确认更新"}
            </Button>
          </div>
        )}
        {emailMsg ? <div className="text-sm text-muted-foreground">{emailMsg}</div> : null}
        {emailErr ? <div className="text-sm text-destructive">{emailErr}</div> : null}
      </div>

      <div className="space-y-3 border-t pt-6">
        <h2 className="text-sm font-medium">{hasPassword ? "修改密码" : "设置密码"}</h2>
        <p className="text-xs text-muted-foreground">
          {hasPassword ? "设置后可用邮箱+密码登录，也可继续用邮箱验证码登录。" : "未设置密码时只能用邮箱验证码登录；设置后两种方式都可用。"}
        </p>
        {hasPassword ? (
          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">原密码</span>
            <input
              type="password"
              autoComplete="off"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputCls}
            />
          </label>
        ) : null}
        <label className="block space-y-1">
          <span className="text-sm text-muted-foreground">新密码（至少 6 位）</span>
          <input
            type="password"
            autoComplete="off"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputCls}
          />
        </label>
        <Button type="button" size="sm" disabled={pwBusy || newPassword.length < 6} onClick={() => void savePassword()}>
          {pwBusy ? "保存中…" : hasPassword ? "修改密码" : "设置密码"}
        </Button>
        {pwMsg ? <div className="text-sm text-muted-foreground">{pwMsg}</div> : null}
        {pwErr ? <div className="text-sm text-destructive">{pwErr}</div> : null}
      </div>
    </div>
  );
}
