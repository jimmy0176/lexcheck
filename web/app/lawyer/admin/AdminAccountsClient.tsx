"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const inputCls = "h-9 w-full rounded-md border bg-background px-2.5 text-sm";

type SettingsState = {
  tempCodeEnabled: boolean;
  tempCode: string;
  registrationMode: string;
  inviteCode: string;
  questionnaireCooldownHours: number;
};

type UserRow = {
  id: string;
  phone: string;
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
  const [settings, setSettings] = useState<SettingsState>(initialSettings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);
  const [settingsErr, setSettingsErr] = useState<string | null>(null);

  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newRole, setNewRole] = useState<"lawyer" | "client">("client");
  const [newName, setNewName] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addErr, setAddErr] = useState<string | null>(null);

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
            ? { name: editName, companyName: editCompany }
            : { name: editName }
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

      <section className="space-y-3 rounded-md border p-4">
        <h2 className="text-base font-medium">添加账号</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-sm text-muted-foreground">手机号</span>
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

      <section className="space-y-3 rounded-md border p-4">
        <h2 className="text-base font-medium">账号列表（{users.length}）</h2>
        <div className="overflow-x-auto rounded-sm border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
              <tr>
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
                    <td className="px-3 py-2">{u.phone}</td>
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
    </div>
  );
}
