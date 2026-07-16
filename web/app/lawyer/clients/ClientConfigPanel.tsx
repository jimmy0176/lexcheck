"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const inputCls = "h-9 w-full rounded-md border bg-background px-2.5 text-sm";

type ClientRow = {
  id: string;
  name: string | null;
  companyName: string | null;
  phone: string;
  createdAt: string;
};

export function ClientConfigPanel() {
  const [clients, setClients] = useState<ClientRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addErr, setAddErr] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  async function loadClients() {
    setErr(null);
    try {
      const res = await fetch("/api/lawyer/clients", { cache: "no-store" });
      if (!res.ok) throw new Error(`加载失败 ${res.status}`);
      const json = (await res.json()) as { clients: ClientRow[] };
      setClients(json.clients);
    } catch (e) {
      setErr(String(e));
    }
  }

  useEffect(() => {
    void loadClients();
  }, []);

  async function addClient() {
    setAddBusy(true);
    setAddErr(null);
    try {
      const res = await fetch("/api/lawyer/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: newPhone, name: newName, companyName: newCompany }),
      });
      const json = (await res.json()) as { ok?: boolean; user?: ClientRow; message?: string };
      if (!res.ok || !json.ok) throw new Error(json.message ?? "添加失败");
      setNewPhone("");
      setNewName("");
      setNewCompany("");
      await loadClients();
    } catch (e) {
      setAddErr(String(e instanceof Error ? e.message : e));
    } finally {
      setAddBusy(false);
    }
  }

  function startEdit(c: ClientRow) {
    setEditingId(c.id);
    setEditName(c.name ?? "");
    setEditCompany(c.companyName ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(c: ClientRow) {
    setEditBusy(true);
    try {
      const res = await fetch(`/api/lawyer/clients/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, companyName: editCompany }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !json.ok) throw new Error(json.message ?? "保存失败");
      setEditingId(null);
      await loadClients();
    } catch (e) {
      setErr(String(e));
    } finally {
      setEditBusy(false);
    }
  }

  async function deleteClient(c: ClientRow) {
    if (!window.confirm(`确认删除客户账号 ${c.companyName ?? c.phone}？此操作不可恢复。`)) return;
    setErr(null);
    try {
      const res = await fetch(`/api/lawyer/clients/${c.id}`, { method: "DELETE" });
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !json.ok) throw new Error(json.message ?? "删除失败");
      await loadClients();
    } catch (e) {
      setErr(String(e));
    }
  }

  return (
    <div className="h-full overflow-y-auto px-8 py-4">
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">客户管理</h1>

        {err ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</div>
        ) : null}

        <section className="space-y-3 rounded-md border p-4">
          <h2 className="text-sm font-medium">新建客户账号</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs text-muted-foreground">手机号</label>
              <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">联系人姓名</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">公司名称</label>
              <input value={newCompany} onChange={(e) => setNewCompany(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" size="sm" disabled={addBusy} onClick={() => void addClient()}>
              {addBusy ? "添加中…" : "添加客户账号"}
            </Button>
            {addErr ? <span className="text-sm text-destructive">{addErr}</span> : null}
          </div>
        </section>

        <section className="space-y-3 rounded-md border p-4">
          <h2 className="text-sm font-medium">客户列表（{clients?.length ?? 0}）</h2>
          {!clients ? (
            <div className="text-sm text-muted-foreground">加载中…</div>
          ) : (
            <div className="overflow-x-auto rounded-sm border">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">手机号</th>
                    <th className="px-3 py-2 font-medium">联系人姓名</th>
                    <th className="px-3 py-2 font-medium">公司名称</th>
                    <th className="px-3 py-2 font-medium">创建时间</th>
                    <th className="px-3 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => {
                    const isEditing = editingId === c.id;
                    return (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="px-3 py-2">{c.phone}</td>
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="h-8 w-28 rounded-sm border bg-background px-2 text-sm"
                            />
                          ) : (
                            c.name ?? "—"
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <input
                              value={editCompany}
                              onChange={(e) => setEditCompany(e.target.value)}
                              className="h-8 w-32 rounded-sm border bg-background px-2 text-sm"
                            />
                          ) : (
                            c.companyName ?? "—"
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</td>
                        <td className="px-3 py-2">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="text-primary underline underline-offset-2 disabled:opacity-50"
                                disabled={editBusy}
                                onClick={() => void saveEdit(c)}
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
                                onClick={() => startEdit(c)}
                              >
                                编辑
                              </button>
                              <button
                                type="button"
                                className="text-destructive underline underline-offset-2"
                                onClick={() => void deleteClient(c)}
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
          )}
        </section>
      </div>
    </div>
  );
}
