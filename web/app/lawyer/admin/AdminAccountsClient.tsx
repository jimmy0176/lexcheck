"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { LLM_PROVIDERS, getProviderById } from "@/lib/llm-providers";

const inputCls = "h-9 w-full rounded-md border bg-background px-2.5 text-sm";

type SettingsState = {
  tempCodeEnabled: boolean;
  tempCode: string;
  registrationMode: string;
  inviteCode: string;
  questionnaireCooldownHours: number;
  sharedLlmProviderId: string;
  sharedLlmModel: string;
  sharedLlmApiKey: string;
  sharedLlmBaseUrl: string;
  backupLlmProviderId: string;
  backupLlmModel: string;
  backupLlmApiKey: string;
  backupLlmBaseUrl: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  smtpFromName: string;
};

function LlmProfileFields({
  providerId,
  model,
  apiKey,
  baseUrl,
  onChange,
}: {
  providerId: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  onChange: (next: { providerId?: string; model?: string; apiKey?: string; baseUrl?: string }) => void;
}) {
  const provider = getProviderById(providerId);
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="block space-y-1">
        <span className="text-sm text-muted-foreground">供应商</span>
        <select
          value={providerId}
          onChange={(e) => {
            const pid = e.target.value;
            const p = getProviderById(pid);
            onChange({ providerId: pid, model: p?.models?.[0] ?? "" });
          }}
          className={inputCls}
        >
          <option value="">未配置</option>
          {LLM_PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      {providerId === "custom" ? (
        <label className="block space-y-1">
          <span className="text-sm text-muted-foreground">Base URL</span>
          <input value={baseUrl} onChange={(e) => onChange({ baseUrl: e.target.value })} className={inputCls} />
        </label>
      ) : (
        <div />
      )}
      <label className="block space-y-1">
        <span className="text-sm text-muted-foreground">模型名称</span>
        {provider?.models?.length ? (
          <select
            value={provider.models.includes(model) ? model : "__custom__"}
            onChange={(e) => {
              const v = e.target.value;
              if (v !== "__custom__") onChange({ model: v });
            }}
            className={inputCls}
          >
            {provider.models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            <option value="__custom__">其他（下方手填）</option>
          </select>
        ) : null}
        <input
          value={model}
          onChange={(e) => onChange({ model: e.target.value })}
          placeholder="模型名称"
          className={`${inputCls} ${provider?.models?.length ? "mt-2" : ""}`}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-sm text-muted-foreground">API Key</span>
        <input
          value={apiKey}
          onChange={(e) => onChange({ apiKey: e.target.value })}
          type="password"
          autoComplete="off"
          className={inputCls}
        />
      </label>
    </div>
  );
}

type UserRow = {
  id: string;
  email: string | null;
  phone: string | null;
  role: string;
  isAdmin: boolean;
  name: string | null;
  companyName: string | null;
  createdAt: string;
};

export function AdminAccountsClient({
  initialSettings,
  initialUsers,
}: {
  initialSettings: SettingsState;
  initialUsers: UserRow[];
}) {
  const [activeTab, setActiveTab] = useState<"register" | "accounts" | "llm" | "email" | "other">("register");
  const [settings, setSettings] = useState<SettingsState>(initialSettings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);
  const [settingsErr, setSettingsErr] = useState<string | null>(null);

  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRole, setNewRole] = useState<"lawyer" | "client">("client");
  const [newName, setNewName] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addErr, setAddErr] = useState<string | null>(null);

  const [testingShared, setTestingShared] = useState(false);
  const [sharedTestHint, setSharedTestHint] = useState<string | null>(null);
  const [sharedTestErr, setSharedTestErr] = useState<string | null>(null);
  const [testingBackup, setTestingBackup] = useState(false);
  const [backupTestHint, setBackupTestHint] = useState<string | null>(null);
  const [backupTestErr, setBackupTestErr] = useState<string | null>(null);

  const [testEmailTo, setTestEmailTo] = useState("");
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailTestHint, setEmailTestHint] = useState<string | null>(null);
  const [emailTestErr, setEmailTestErr] = useState<string | null>(null);

  async function testEmailSend() {
    setTestingEmail(true);
    setEmailTestHint(null);
    setEmailTestErr(null);
    try {
      const res = await fetch("/api/admin/email/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtpHost: settings.smtpHost.trim(),
          smtpPort: settings.smtpPort,
          smtpSecure: settings.smtpSecure,
          smtpUser: settings.smtpUser.trim(),
          smtpPass: settings.smtpPass.trim(),
          smtpFromName: settings.smtpFromName.trim(),
          to: testEmailTo.trim(),
        }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (json.ok) {
        setEmailTestHint(json.message ?? "发送成功");
      } else {
        setEmailTestErr(json.error ?? "发送失败");
      }
    } catch (e) {
      setEmailTestErr(e instanceof Error ? e.message : String(e));
    } finally {
      setTestingEmail(false);
    }
  }

  async function testLlmConnection(kind: "shared" | "backup") {
    const providerId = kind === "shared" ? settings.sharedLlmProviderId : settings.backupLlmProviderId;
    const model = kind === "shared" ? settings.sharedLlmModel : settings.backupLlmModel;
    const apiKey = kind === "shared" ? settings.sharedLlmApiKey : settings.backupLlmApiKey;
    const baseUrl = kind === "shared" ? settings.sharedLlmBaseUrl : settings.backupLlmBaseUrl;
    const setTesting = kind === "shared" ? setTestingShared : setTestingBackup;
    const setHint = kind === "shared" ? setSharedTestHint : setBackupTestHint;
    const setErr = kind === "shared" ? setSharedTestErr : setBackupTestErr;

    setTesting(true);
    setHint(null);
    setErr(null);
    try {
      const res = await fetch("/api/lawyer/llm/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId,
          model: model.trim(),
          apiKey: apiKey.trim(),
          baseUrlOverride: providerId === "custom" ? baseUrl.trim() : undefined,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (json.ok) {
        setHint(json.message ?? "连通成功");
      } else {
        setErr(json.error ?? "连通失败");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  }

  async function saveSettings() {
    setSavingSettings(true);
    setSettingsErr(null);
    setSettingsMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !json.ok) throw new Error(json.message ?? "保存失败");
      setSettingsMsg("已保存");
    } catch (e) {
      setSettingsErr(String(e instanceof Error ? e.message : e));
    } finally {
      setSavingSettings(false);
    }
  }

  async function addUser() {
    setAddBusy(true);
    setAddErr(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          phone: newPhone,
          role: newRole,
          name: newName,
          companyName: newCompany,
          isAdmin: newIsAdmin,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; user?: UserRow; message?: string };
      if (!res.ok || !json.ok || !json.user) throw new Error(json.message ?? "添加失败");
      setUsers((prev) => [json.user as UserRow, ...prev]);
      setNewEmail("");
      setNewPhone("");
      setNewName("");
      setNewCompany("");
      setNewIsAdmin(false);
    } catch (e) {
      setAddErr(String(e instanceof Error ? e.message : e));
    } finally {
      setAddBusy(false);
    }
  }

  async function toggleAdmin(user: UserRow) {
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAdmin: !user.isAdmin }),
    });
    const json = (await res.json()) as { ok?: boolean; user?: UserRow; message?: string };
    if (res.ok && json.ok && json.user) {
      setUsers((prev) => prev.map((u) => (u.id === user.id ? (json.user as UserRow) : u)));
    } else {
      window.alert(json.message ?? "操作失败");
    }
  }

  function startEdit(user: UserRow) {
    setEditingId(user.id);
    setEditName(user.name ?? "");
    setEditCompany(user.companyName ?? "");
    setEditEmail(user.email ?? "");
    setEditPhone(user.phone ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(user: UserRow) {
    setEditBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          user.role === "client"
            ? { name: editName, companyName: editCompany, email: editEmail, phone: editPhone }
            : { name: editName, email: editEmail, phone: editPhone }
        ),
      });
      const json = (await res.json()) as { ok?: boolean; user?: UserRow; message?: string };
      if (!res.ok || !json.ok || !json.user) throw new Error(json.message ?? "保存失败");
      setUsers((prev) => prev.map((u) => (u.id === user.id ? (json.user as UserRow) : u)));
      setEditingId(null);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    } finally {
      setEditBusy(false);
    }
  }

  async function deleteUser(user: UserRow) {
    if (!window.confirm(`确认删除账号 ${user.phone}？此操作不可恢复。`)) return;
    const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    const json = (await res.json()) as { ok?: boolean; message?: string };
    if (res.ok && json.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } else {
      window.alert(json.message ?? "删除失败");
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex shrink-0 items-stretch gap-4 border-b border-border">
        {(
          [
            { key: "register", label: "注册模式" },
            { key: "accounts", label: "账号管理" },
            { key: "llm", label: "公用大模型" },
            { key: "email", label: "系统邮箱" },
            { key: "other", label: "其他设置" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`-mb-px shrink-0 border-b-2 px-1 py-2 text-base font-medium transition-colors ${
              activeTab === tab.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "register" ? (
      <section className="space-y-3 rounded-md border p-4">
        <h2 className="text-base font-medium">验证码与注册设置</h2>

        <label className="flex items-center gap-2">
          <Checkbox
            checked={settings.tempCodeEnabled}
            onCheckedChange={(v) => setSettings((s) => ({ ...s, tempCodeEnabled: v === true }))}
          />
          <span className="text-sm">启用临时验证码登录</span>
        </label>

        {settings.tempCodeEnabled ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
            已开启临时验证码登录：任何手机号输入下方这个验证码都可以登录/注册（包括登录管理员账号）。
            短信服务商接入前必须保持开启系统才可用，但正式对外上线前请务必确认这不是长期方案，并妥善保管此验证码。
          </div>
        ) : (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            已关闭临时验证码登录，且短信服务商尚未接入——当前没有任何账号能够登录。仅在已接入真实短信验证码后关闭此项。
          </div>
        )}

        <label className="block space-y-1">
          <span className="text-sm text-muted-foreground">临时验证码</span>
          <input
            value={settings.tempCode}
            onChange={(e) => setSettings((s) => ({ ...s, tempCode: e.target.value }))}
            className={inputCls}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-muted-foreground">客户注册模式</span>
          <select
            value={settings.registrationMode}
            onChange={(e) => setSettings((s) => ({ ...s, registrationMode: e.target.value }))}
            className={inputCls}
          >
            <option value="invite_only">邀请码模式（需邀请码才能注册）</option>
            <option value="open">开放注册（手机号+验证码即可注册）</option>
          </select>
        </label>

        {settings.registrationMode === "invite_only" ? (
          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">邀请码</span>
            <input
              value={settings.inviteCode}
              onChange={(e) => setSettings((s) => ({ ...s, inviteCode: e.target.value }))}
              className={inputCls}
            />
          </label>
        ) : null}

        <div className="flex items-center gap-2">
          <Button type="button" size="sm" disabled={savingSettings} onClick={() => void saveSettings()}>
            {savingSettings ? "保存中…" : "保存设置"}
          </Button>
          {settingsMsg ? <span className="text-sm text-muted-foreground">{settingsMsg}</span> : null}
          {settingsErr ? <span className="text-sm text-destructive">{settingsErr}</span> : null}
        </div>
      </section>
      ) : null}

      {activeTab === "email" ? (
      <section className="space-y-4 rounded-md border p-4">
        <div>
          <h2 className="text-base font-medium">系统邮箱（SMTP）</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            用于向客户发送体检报告等系统邮件。多数邮箱需要在邮箱管理后台单独开启 SMTP 服务并生成授权码（不是登录密码）。
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">SMTP 服务器</span>
            <input
              value={settings.smtpHost}
              onChange={(e) => setSettings((s) => ({ ...s, smtpHost: e.target.value }))}
              placeholder="smtp.163.com"
              className={inputCls}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">端口</span>
            <input
              type="number"
              value={settings.smtpPort}
              onChange={(e) => setSettings((s) => ({ ...s, smtpPort: Number(e.target.value) || 0 }))}
              className={inputCls}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">发件邮箱</span>
            <input
              value={settings.smtpUser}
              onChange={(e) => setSettings((s) => ({ ...s, smtpUser: e.target.value }))}
              placeholder="name@example.com"
              className={inputCls}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">授权码 / 密码</span>
            <input
              value={settings.smtpPass}
              onChange={(e) => setSettings((s) => ({ ...s, smtpPass: e.target.value }))}
              type="password"
              autoComplete="off"
              className={inputCls}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">发件人显示名称（可选）</span>
            <input
              value={settings.smtpFromName}
              onChange={(e) => setSettings((s) => ({ ...s, smtpFromName: e.target.value }))}
              placeholder="Lexcheck"
              className={inputCls}
            />
          </label>
          <label className="flex items-center gap-2 pt-6">
            <Checkbox
              checked={settings.smtpSecure}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, smtpSecure: v === true }))}
            />
            <span className="text-sm">使用 SSL（端口 465 通常需要勾选，587 通常不勾选）</span>
          </label>
        </div>

        <div className="space-y-2 border-t pt-3">
          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">测试收件邮箱</span>
            <input
              value={testEmailTo}
              onChange={(e) => setTestEmailTo(e.target.value)}
              placeholder="用于接收测试邮件的邮箱地址"
              className={inputCls}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={testingEmail}
              onClick={() => void testEmailSend()}
            >
              {testingEmail ? "发送中…" : "发送测试邮件"}
            </Button>
            {emailTestErr ? (
              <span className="text-xs text-destructive">{emailTestErr}</span>
            ) : emailTestHint ? (
              <span className="text-xs text-muted-foreground">{emailTestHint}</span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" size="sm" disabled={savingSettings} onClick={() => void saveSettings()}>
            {savingSettings ? "保存中…" : "保存设置"}
          </Button>
          {settingsMsg ? <span className="text-sm text-muted-foreground">{settingsMsg}</span> : null}
          {settingsErr ? <span className="text-sm text-destructive">{settingsErr}</span> : null}
        </div>
      </section>
      ) : null}

      {activeTab === "other" ? (
      <section className="space-y-3 rounded-md border p-4">
        <h2 className="text-base font-medium">其他设置</h2>

        <label className="block space-y-1">
          <span className="text-sm text-muted-foreground">客户重新填写问卷间隔（小时）</span>
          <input
            type="number"
            min={0}
            value={settings.questionnaireCooldownHours}
            onChange={(e) =>
              setSettings((s) => ({ ...s, questionnaireCooldownHours: Number(e.target.value) || 0 }))
            }
            className={inputCls}
          />
        </label>

        <div className="flex items-center gap-2">
          <Button type="button" size="sm" disabled={savingSettings} onClick={() => void saveSettings()}>
            {savingSettings ? "保存中…" : "保存设置"}
          </Button>
          {settingsMsg ? <span className="text-sm text-muted-foreground">{settingsMsg}</span> : null}
          {settingsErr ? <span className="text-sm text-destructive">{settingsErr}</span> : null}
        </div>
      </section>
      ) : null}

      {activeTab === "llm" ? (
      <section className="space-y-4 rounded-md border p-4">
        <div>
          <h2 className="text-base font-medium">大模型 Key 优先级</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            生成报告时按顺序尝试：律师本人在工作台设置的 Key → 下方&ldquo;共用 Key&rdquo; → 下方&ldquo;共用备用 Key&rdquo;。
            三个都不可用或调用失败时，退化为不调用大模型的纯拼接版报告。
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">共用 Key（第二优先级）</h3>
          <LlmProfileFields
            providerId={settings.sharedLlmProviderId}
            model={settings.sharedLlmModel}
            apiKey={settings.sharedLlmApiKey}
            baseUrl={settings.sharedLlmBaseUrl}
            onChange={(next) =>
              setSettings((s) => ({
                ...s,
                sharedLlmProviderId: next.providerId ?? s.sharedLlmProviderId,
                sharedLlmModel: next.model ?? s.sharedLlmModel,
                sharedLlmApiKey: next.apiKey ?? s.sharedLlmApiKey,
                sharedLlmBaseUrl: next.baseUrl ?? s.sharedLlmBaseUrl,
              }))
            }
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={testingShared}
              onClick={() => void testLlmConnection("shared")}
            >
              {testingShared ? "检测中…" : "检测连通性"}
            </Button>
            {sharedTestErr ? (
              <span className="text-xs text-destructive">{sharedTestErr}</span>
            ) : sharedTestHint ? (
              <span className="text-xs text-muted-foreground">{sharedTestHint}</span>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">共用备用 Key（第三优先级）</h3>
          <LlmProfileFields
            providerId={settings.backupLlmProviderId}
            model={settings.backupLlmModel}
            apiKey={settings.backupLlmApiKey}
            baseUrl={settings.backupLlmBaseUrl}
            onChange={(next) =>
              setSettings((s) => ({
                ...s,
                backupLlmProviderId: next.providerId ?? s.backupLlmProviderId,
                backupLlmModel: next.model ?? s.backupLlmModel,
                backupLlmApiKey: next.apiKey ?? s.backupLlmApiKey,
                backupLlmBaseUrl: next.baseUrl ?? s.backupLlmBaseUrl,
              }))
            }
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={testingBackup}
              onClick={() => void testLlmConnection("backup")}
            >
              {testingBackup ? "检测中…" : "检测连通性"}
            </Button>
            {backupTestErr ? (
              <span className="text-xs text-destructive">{backupTestErr}</span>
            ) : backupTestHint ? (
              <span className="text-xs text-muted-foreground">{backupTestHint}</span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" size="sm" disabled={savingSettings} onClick={() => void saveSettings()}>
            {savingSettings ? "保存中…" : "保存设置"}
          </Button>
          {settingsMsg ? <span className="text-sm text-muted-foreground">{settingsMsg}</span> : null}
          {settingsErr ? <span className="text-sm text-destructive">{settingsErr}</span> : null}
        </div>
      </section>
      ) : null}

      {activeTab === "accounts" ? (
      <section className="space-y-3 rounded-md border p-4">
        <h2 className="text-base font-medium">添加账号</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">邮箱</span>
            <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={inputCls} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">手机号（可选）</span>
            <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className={inputCls} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">角色</span>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value === "lawyer" ? "lawyer" : "client")}
              className={inputCls}
            >
              <option value="client">客户</option>
              <option value="lawyer">律师</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">姓名</span>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} className={inputCls} />
          </label>
          {newRole === "client" ? (
            <label className="block space-y-1">
              <span className="text-sm text-muted-foreground">公司名称</span>
              <input value={newCompany} onChange={(e) => setNewCompany(e.target.value)} className={inputCls} />
            </label>
          ) : (
            <label className="flex items-center gap-2 pt-6">
              <Checkbox checked={newIsAdmin} onCheckedChange={(v) => setNewIsAdmin(v === true)} />
              <span className="text-sm">设为管理员</span>
            </label>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" disabled={addBusy} onClick={() => void addUser()}>
            {addBusy ? "添加中…" : "添加账号"}
          </Button>
          {addErr ? <span className="text-sm text-destructive">{addErr}</span> : null}
        </div>
      </section>
      ) : null}

      {activeTab === "accounts" ? (
      <section className="space-y-3 rounded-md border p-4">
        <h2 className="text-base font-medium">账号列表（{users.length}）</h2>
        <div className="overflow-x-auto rounded-sm border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">邮箱</th>
                <th className="px-3 py-2 font-medium">手机号</th>
                <th className="px-3 py-2 font-medium">角色</th>
                <th className="px-3 py-2 font-medium">姓名</th>
                <th className="px-3 py-2 font-medium">公司名称</th>
                <th className="px-3 py-2 font-medium">管理员</th>
                <th className="px-3 py-2 font-medium">创建时间</th>
                <th className="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isEditing = editingId === u.id;
                return (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          className="h-8 w-40 rounded-sm border bg-background px-2 text-sm"
                        />
                      ) : (
                        u.email ?? "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          className="h-8 w-28 rounded-sm border bg-background px-2 text-sm"
                        />
                      ) : (
                        u.phone ?? "—"
                      )}
                    </td>
                    <td className="px-3 py-2">{u.role === "lawyer" ? "律师" : "客户"}</td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8 w-28 rounded-sm border bg-background px-2 text-sm"
                        />
                      ) : (
                        u.name ?? "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing && u.role === "client" ? (
                        <input
                          value={editCompany}
                          onChange={(e) => setEditCompany(e.target.value)}
                          className="h-8 w-32 rounded-sm border bg-background px-2 text-sm"
                        />
                      ) : (
                        u.companyName ?? "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {u.role === "lawyer" ? (
                        <button
                          type="button"
                          className={u.isAdmin ? "text-primary underline underline-offset-2" : "text-muted-foreground underline underline-offset-2"}
                          onClick={() => void toggleAdmin(u)}
                        >
                          {u.isAdmin ? "是" : "否"}
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {new Date(u.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="text-primary underline underline-offset-2 disabled:opacity-50"
                            disabled={editBusy}
                            onClick={() => void saveEdit(u)}
                          >
                            保存
                          </button>
                          <button
                            type="button"
                            className="text-muted-foreground underline underline-offset-2"
                            disabled={editBusy}
                            onClick={cancelEdit}
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="text-muted-foreground underline underline-offset-2"
                            onClick={() => startEdit(u)}
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            className="text-destructive underline underline-offset-2"
                            onClick={() => void deleteUser(u)}
                          >
                            删除
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}
    </div>
  );
}
