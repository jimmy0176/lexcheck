"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { QuestionnaireConfig } from "@/lib/questionnaire-types";

const inputCls = "h-9 w-full rounded-md border bg-background px-2.5 text-sm";

type TemplateItem = {
  id: string;
  name: string;
  note: string | null;
  createdAt: string;
  sectionCount: number;
  questionCount: number;
  checkupCount: number;
  assignmentCount: number;
  locked: boolean;
};

type XlsxError = { sheet: string; row: number; message: string };

type ClientItem = { id: string; name: string | null; companyName: string | null; phone: string };

type CollectedItem = {
  id: string;
  token: string;
  companyName: string | null;
  contactName: string | null;
  contactPhone: string | null;
  submittedAt: string | null;
  templateName: string | null;
};

export function QuestionnaireConfigPanel() {
  const [activeTab, setActiveTab] = useState<"templates" | "assign" | "uncollected" | "collected">("templates");
  const [templates, setTemplates] = useState<TemplateItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importName, setImportName] = useState("");
  const [importNote, setImportNote] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importErrors, setImportErrors] = useState<XlsxError[] | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientItem[] | null>(null);
  const [assignBroadcast, setAssignBroadcast] = useState(false);
  const [assignClientIds, setAssignClientIds] = useState<Set<string>>(new Set());
  const [assignBusy, setAssignBusy] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedConfig, setExpandedConfig] = useState<QuestionnaireConfig | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);

  const [collected, setCollected] = useState<CollectedItem[] | null>(null);
  const [collectedErr, setCollectedErr] = useState<string | null>(null);
  const [uncollected, setUncollected] = useState<CollectedItem[] | null>(null);
  const [uncollectedErr, setUncollectedErr] = useState<string | null>(null);
  const [deletingToken, setDeletingToken] = useState<string | null>(null);

  async function loadTemplates() {
    setErr(null);
    try {
      const res = await fetch("/api/lawyer/questionnaire-templates", { cache: "no-store" });
      if (!res.ok) throw new Error(`加载失败 ${res.status}`);
      const json = (await res.json()) as { templates: TemplateItem[] };
      setTemplates(json.templates);
    } catch (e) {
      setErr(String(e));
    }
  }

  useEffect(() => {
    void loadTemplates();
  }, []);

  async function submitImport() {
    if (!importFile || !importName.trim()) return;
    setImportBusy(true);
    setImportErrors(null);
    setErr(null);
    try {
      const form = new FormData();
      form.set("file", importFile);
      form.set("name", importName.trim());
      form.set("note", importNote.trim());
      const res = await fetch("/api/lawyer/questionnaire-templates", { method: "POST", body: form });
      const json = (await res.json()) as { ok?: boolean; errors?: XlsxError[]; message?: string; error?: string };
      if (!res.ok) {
        if (json.errors?.length) {
          setImportErrors(json.errors);
        } else {
          setErr(json.message ?? json.error ?? `导入失败 ${res.status}`);
        }
        return;
      }
      setMsg("导入成功，已生成新问卷");
      setShowImport(false);
      setImportFile(null);
      setImportName("");
      setImportNote("");
      await loadTemplates();
    } catch (e) {
      setErr(String(e));
    } finally {
      setImportBusy(false);
    }
  }

  function startEdit(t: TemplateItem) {
    setEditingId(t.id);
    setEditName(t.name);
    setEditNote(t.note ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(t: TemplateItem) {
    setEditBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/lawyer/questionnaire-templates/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), note: editNote.trim() }),
      });
      if (!res.ok) throw new Error(`保存失败 ${res.status}`);
      setEditingId(null);
      await loadTemplates();
    } catch (e) {
      setErr(String(e));
    } finally {
      setEditBusy(false);
    }
  }

  async function deleteTemplate(t: TemplateItem) {
    if (!window.confirm(`确认删除问卷「${t.name}」？此操作不可撤销。`)) return;
    setErr(null);
    try {
      const res = await fetch(`/api/lawyer/questionnaire-templates/${t.id}`, { method: "DELETE" });
      const json = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `删除失败 ${res.status}`);
      await loadTemplates();
    } catch (e) {
      setErr(String(e));
    }
  }

  async function openAssign(t: TemplateItem) {
    setAssigningId(t.id);
    setAssignBroadcast(false);
    setAssignClientIds(new Set());
    setErr(null);
    try {
      const [clientsRes, assignRes] = await Promise.all([
        clients ? Promise.resolve(null) : fetch("/api/lawyer/clients", { cache: "no-store" }),
        fetch(`/api/lawyer/questionnaire-templates/${t.id}/assignments`, { cache: "no-store" }),
      ]);
      if (clientsRes) {
        const cj = (await clientsRes.json()) as { clients: ClientItem[] };
        setClients(cj.clients);
      }
      const aj = (await assignRes.json()) as { broadcast: boolean; clientIds: string[] };
      setAssignBroadcast(aj.broadcast);
      setAssignClientIds(new Set(aj.clientIds));
    } catch (e) {
      setErr(String(e));
    }
  }

  async function saveAssign() {
    if (!assigningId) return;
    setAssignBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/lawyer/questionnaire-templates/${assigningId}/assignments`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ broadcast: assignBroadcast, clientIds: [...assignClientIds] }),
      });
      if (!res.ok) throw new Error(`保存失败 ${res.status}`);
      setMsg("推送设置已保存");
      setAssigningId(null);
      await loadTemplates();
    } catch (e) {
      setErr(String(e));
    } finally {
      setAssignBusy(false);
    }
  }

  async function toggleExpand(t: TemplateItem) {
    if (expandedId === t.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(t.id);
    setExpandedConfig(null);
    setExpandedLoading(true);
    try {
      const res = await fetch(`/api/lawyer/questionnaire-templates/${t.id}`, { cache: "no-store" });
      const json = (await res.json()) as { config: QuestionnaireConfig };
      setExpandedConfig(json.config);
    } catch (e) {
      setErr(String(e));
    } finally {
      setExpandedLoading(false);
    }
  }

  async function loadCollected() {
    setCollectedErr(null);
    try {
      const res = await fetch("/api/lawyer/checkups?status=submitted", { cache: "no-store" });
      if (!res.ok) throw new Error(`加载失败 ${res.status}`);
      const json = (await res.json()) as { checkups: CollectedItem[] };
      setCollected(json.checkups);
    } catch (e) {
      setCollectedErr(String(e));
    }
  }

  async function loadUncollected() {
    setUncollectedErr(null);
    try {
      const res = await fetch("/api/lawyer/checkups?status=draft", { cache: "no-store" });
      if (!res.ok) throw new Error(`加载失败 ${res.status}`);
      const json = (await res.json()) as { checkups: CollectedItem[] };
      setUncollected(json.checkups);
    } catch (e) {
      setUncollectedErr(String(e));
    }
  }

  useEffect(() => {
    if (activeTab === "collected" && collected === null) {
      void loadCollected();
    }
    if (activeTab === "uncollected" && uncollected === null) {
      void loadUncollected();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  async function deleteCollected(item: CollectedItem) {
    if (
      !window.confirm(
        `确认删除「${item.companyName || item.contactName || item.token}」的已收集问卷？关联的已生成报告等信息将一并删除，此操作不可撤销。`
      )
    )
      return;
    setDeletingToken(item.token);
    setCollectedErr(null);
    try {
      const res = await fetch(`/api/lawyer/checkups/${item.token}`, { method: "DELETE" });
      const json = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `删除失败 ${res.status}`);
      await loadCollected();
    } catch (e) {
      setCollectedErr(String(e));
    } finally {
      setDeletingToken(null);
    }
  }

  async function deleteUncollected(item: CollectedItem) {
    if (
      !window.confirm(
        `确认删除「${item.companyName || item.contactName || item.token}」的未收集问卷（草稿）？此操作不可撤销。`
      )
    )
      return;
    setDeletingToken(item.token);
    setUncollectedErr(null);
    try {
      const res = await fetch(`/api/lawyer/checkups/${item.token}`, { method: "DELETE" });
      const json = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `删除失败 ${res.status}`);
      await loadUncollected();
    } catch (e) {
      setUncollectedErr(String(e));
    } finally {
      setDeletingToken(null);
    }
  }

  return (
    <div className="h-full overflow-y-auto px-8 py-4">
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">问卷管理</h1>

        <div className="flex shrink-0 items-stretch gap-4 border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab("templates")}
            className={`-mb-px shrink-0 border-b-2 px-1 py-2 text-base font-medium transition-colors ${
              activeTab === "templates"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            模板管理
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("assign")}
            className={`-mb-px shrink-0 border-b-2 px-1 py-2 text-base font-medium transition-colors ${
              activeTab === "assign"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            推送设置
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("uncollected")}
            className={`-mb-px shrink-0 border-b-2 px-1 py-2 text-base font-medium transition-colors ${
              activeTab === "uncollected"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            未收集
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("collected")}
            className={`-mb-px shrink-0 border-b-2 px-1 py-2 text-base font-medium transition-colors ${
              activeTab === "collected"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            已收集
          </button>
        </div>

        {err ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{err}</div>
        ) : null}
        {msg ? (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-900 dark:text-emerald-100">
            {msg}
          </div>
        ) : null}

        {activeTab === "templates" ? (
        <>
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={() => setShowImport((v) => !v)}>
            {showImport ? "取消导入" : "导入问卷"}
          </Button>
        </div>

        {showImport ? (
          <section className="space-y-3 rounded-md border p-4">
            <h2 className="text-sm font-medium">导入新问卷</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground">问卷名称</label>
                <input value={importName} onChange={(e) => setImportName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">备注（可选）</label>
                <input value={importNote} onChange={(e) => setImportNote(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">选择 .xlsx 文件</label>
              <input
                type="file"
                accept=".xlsx"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                className="block text-sm"
              />
            </div>
            {importErrors?.length ? (
              <div className="space-y-1 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                <div className="font-medium">导入校验未通过：</div>
                {importErrors.map((e, i) => (
                  <div key={i}>
                    [{e.sheet || "文件"}
                    {e.row ? ` 第 ${e.row} 行` : ""}] {e.message}
                  </div>
                ))}
              </div>
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={importBusy || !importFile || !importName.trim()}
              onClick={() => void submitImport()}
            >
              {importBusy ? "导入中…" : "确认导入"}
            </Button>
          </section>
        ) : null}

        <section className="space-y-3 rounded-md border p-4">
          <h2 className="text-sm font-medium">问卷列表（{templates?.length ?? 0}）</h2>
          {!templates ? (
            <div className="text-sm text-muted-foreground">加载中…</div>
          ) : (
            <div className="overflow-x-auto rounded-sm border">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">名称</th>
                    <th className="px-3 py-2 font-medium">备注</th>
                    <th className="px-3 py-2 font-medium">题目数</th>
                    <th className="px-3 py-2 font-medium">状态</th>
                    <th className="px-3 py-2 font-medium">创建时间</th>
                    <th className="px-3 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((t) => {
                    const isEditing = editingId === t.id;
                    return (
                      <>
                        <tr key={t.id} className="border-b last:border-0">
                          <td className="px-3 py-2">
                            {isEditing ? (
                              <input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="h-8 w-32 rounded-sm border bg-background px-2 text-sm"
                              />
                            ) : (
                              <button
                                type="button"
                                className="underline underline-offset-2"
                                onClick={() => void toggleExpand(t)}
                              >
                                {t.name}
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {isEditing ? (
                              <input
                                value={editNote}
                                onChange={(e) => setEditNote(e.target.value)}
                                className="h-8 w-40 rounded-sm border bg-background px-2 text-sm"
                              />
                            ) : (
                              t.note || "—"
                            )}
                          </td>
                          <td className="px-3 py-2">{t.questionCount}</td>
                          <td className="px-3 py-2">
                            {t.locked ? (
                              <span className="text-amber-700 dark:text-amber-300">已锁定（{t.checkupCount} 份使用中）</span>
                            ) : (
                              <span className="text-muted-foreground">未锁定</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{new Date(t.createdAt).toLocaleString()}</td>
                          <td className="px-3 py-2">
                            {isEditing ? (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className="text-primary underline underline-offset-2 disabled:opacity-50"
                                  disabled={editBusy}
                                  onClick={() => void saveEdit(t)}
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
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  className="text-muted-foreground underline underline-offset-2"
                                  onClick={() => startEdit(t)}
                                >
                                  改名/备注
                                </button>
                                <a
                                  href={`/api/lawyer/questionnaire-templates/${t.id}/export`}
                                  className="text-muted-foreground underline underline-offset-2"
                                >
                                  导出
                                </a>
                                {!t.locked ? (
                                  <button
                                    type="button"
                                    className="text-destructive underline underline-offset-2"
                                    onClick={() => void deleteTemplate(t)}
                                  >
                                    删除
                                  </button>
                                ) : null}
                              </div>
                            )}
                          </td>
                        </tr>
                        {expandedId === t.id ? (
                          <tr>
                            <td colSpan={6} className="border-b bg-muted/10 px-3 py-3">
                              {expandedLoading ? (
                                <div className="text-sm text-muted-foreground">加载中…</div>
                              ) : expandedConfig ? (
                                <div className="space-y-3">
                                  {expandedConfig.sections.map((s) => (
                                    <div key={s.sectionId} className="rounded-sm border p-3">
                                      <div className="text-sm font-medium">
                                        {s.title}
                                        {typeof s.maxScore === "number" ? `（满分 ${s.maxScore}）` : ""}
                                      </div>
                                      <div className="mt-2 space-y-2">
                                        {s.questions.map((q) => (
                                          <div key={q.qid} className="rounded-sm bg-background p-2 text-xs">
                                            <div className="font-medium">
                                              {q.qid}. {q.question}
                                            </div>
                                            {q.type === "single_choice" || q.type === "multi_choice_with_other" ? (
                                              <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
                                                {q.options.map((o) => (
                                                  <li key={o.value}>
                                                    {o.label}
                                                    {typeof o.score === "number" ? `（${o.score} 分）` : ""}
                                                    {o.riskText ? <div>风险：{o.riskText}</div> : null}
                                                    {o.adviceText ? <div>建议：{o.adviceText}</div> : null}
                                                  </li>
                                                ))}
                                              </ul>
                                            ) : null}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-sm text-muted-foreground">加载失败</div>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        </>
        ) : activeTab === "assign" ? (
        <>
        <section className="space-y-3 rounded-md border p-4">
          <h2 className="text-sm font-medium">推送设置（{templates?.length ?? 0}）</h2>
          {!templates ? (
            <div className="text-sm text-muted-foreground">加载中…</div>
          ) : (
            <div className="overflow-x-auto rounded-sm border">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">名称</th>
                    <th className="px-3 py-2 font-medium">状态</th>
                    <th className="px-3 py-2 font-medium">当前推送范围</th>
                    <th className="px-3 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((t) => (
                    <tr key={t.id} className="border-b last:border-0">
                      <td className="px-3 py-2">{t.name}</td>
                      <td className="px-3 py-2">
                        {t.locked ? (
                          <span className="text-amber-700 dark:text-amber-300">已锁定（{t.checkupCount} 份使用中）</span>
                        ) : (
                          <span className="text-muted-foreground">未锁定</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {t.assignmentCount > 0 ? `已设置（${t.assignmentCount}）` : "未设置"}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="text-muted-foreground underline underline-offset-2"
                          onClick={() => void openAssign(t)}
                        >
                          设置推送
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {assigningId ? (
          <section className="space-y-3 rounded-md border p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">推送设置</h2>
              <button
                type="button"
                className="text-xs text-muted-foreground underline underline-offset-2"
                onClick={() => setAssigningId(null)}
              >
                关闭
              </button>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={assignBroadcast} onChange={(e) => setAssignBroadcast(e.target.checked)} />
              推送给所有客户
            </label>
            {!assignBroadcast ? (
              <div className="max-h-60 space-y-1 overflow-y-auto rounded-sm border p-2">
                {!clients ? (
                  <div className="text-sm text-muted-foreground">加载中…</div>
                ) : clients.length === 0 ? (
                  <div className="text-sm text-muted-foreground">暂无客户账号</div>
                ) : (
                  clients.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={assignClientIds.has(c.id)}
                        onChange={(e) =>
                          setAssignClientIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(c.id);
                            else next.delete(c.id);
                            return next;
                          })
                        }
                      />
                      {c.companyName || c.name || c.phone}（{c.phone}）
                    </label>
                  ))
                )}
              </div>
            ) : null}
            <Button type="button" size="sm" disabled={assignBusy} onClick={() => void saveAssign()}>
              {assignBusy ? "保存中…" : "保存推送设置"}
            </Button>
          </section>
        ) : null}
        </>
        ) : activeTab === "uncollected" ? (
        <>
        {uncollectedErr ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {uncollectedErr}
          </div>
        ) : null}
        <section className="space-y-3 rounded-md border p-4">
          <h2 className="text-sm font-medium">未收集（{uncollected?.length ?? 0}）</h2>
          {!uncollected ? (
            <div className="text-sm text-muted-foreground">加载中…</div>
          ) : uncollected.length === 0 ? (
            <div className="text-sm text-muted-foreground">暂无未提交的问卷草稿。</div>
          ) : (
            <div className="overflow-x-auto rounded-sm border">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">公司名称</th>
                    <th className="px-3 py-2 font-medium">联系人</th>
                    <th className="px-3 py-2 font-medium">联系电话</th>
                    <th className="px-3 py-2 font-medium">使用问卷</th>
                    <th className="px-3 py-2 font-medium">状态</th>
                    <th className="px-3 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {uncollected.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="px-3 py-2">{item.companyName || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{item.contactName || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{item.contactPhone || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{item.templateName || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">未提交</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="text-destructive underline underline-offset-2 disabled:opacity-50"
                          disabled={deletingToken === item.token}
                          onClick={() => void deleteUncollected(item)}
                        >
                          {deletingToken === item.token ? "删除中…" : "删除"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        </>
        ) : (
        <>
        {collectedErr ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {collectedErr}
          </div>
        ) : null}
        <section className="space-y-3 rounded-md border p-4">
          <h2 className="text-sm font-medium">已收集（{collected?.length ?? 0}）</h2>
          {!collected ? (
            <div className="text-sm text-muted-foreground">加载中…</div>
          ) : collected.length === 0 ? (
            <div className="text-sm text-muted-foreground">暂无已提交的问卷。</div>
          ) : (
            <div className="overflow-x-auto rounded-sm border">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">公司名称</th>
                    <th className="px-3 py-2 font-medium">联系人</th>
                    <th className="px-3 py-2 font-medium">联系电话</th>
                    <th className="px-3 py-2 font-medium">使用问卷</th>
                    <th className="px-3 py-2 font-medium">提交时间</th>
                    <th className="px-3 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {collected.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="px-3 py-2">{item.companyName || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{item.contactName || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{item.contactPhone || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{item.templateName || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {item.submittedAt ? new Date(item.submittedAt).toLocaleString() : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="text-destructive underline underline-offset-2 disabled:opacity-50"
                          disabled={deletingToken === item.token}
                          onClick={() => void deleteCollected(item)}
                        >
                          {deletingToken === item.token ? "删除中…" : "删除"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        </>
        )}
      </div>
    </div>
  );
}
