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
}: {
  initialName: string;
  role: string;
  companyName: string | null;
  phone: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

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

  return (
    <div className="space-y-4">
      <label className="block space-y-1">
        <span className="text-sm text-muted-foreground">账号</span>
        <input value={phone} disabled className={readOnlyCls} />
      </label>
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
        <span className="text-sm text-muted-foreground">姓名</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
      </label>

      <Button type="button" size="sm" disabled={busy || !name.trim()} onClick={() => void save()}>
        {busy ? "保存中…" : "保存"}
      </Button>

      {msg ? <div className="text-sm text-muted-foreground">{msg}</div> : null}
      {err ? <div className="text-sm text-destructive">{err}</div> : null}
    </div>
  );
}
