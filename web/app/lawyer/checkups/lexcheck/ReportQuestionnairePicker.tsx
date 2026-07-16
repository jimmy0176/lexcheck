"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import type { DashboardRow } from "./Dashboard";

export function ReportQuestionnairePicker({ rows }: { rows: DashboardRow[] }) {
  const [search, setSearch] = useState("");
  const [showDrafts, setShowDrafts] = useState(false);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (!showDrafts && row.status !== "submitted") return false;
      if (!q) return true;
      const haystack = [
        row.companyName ?? "",
        row.contactName ?? "",
        row.contactPhone ?? "",
        row.status === "submitted" ? "已提交" : "草稿",
        row.submittedAt ? new Date(row.submittedAt).toLocaleString() : "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, search, showDrafts]);

  return (
    <div className="flex h-full flex-col overflow-y-auto px-8 py-4">
      <h1 className="shrink-0 text-2xl font-semibold tracking-tight">选择问卷</h1>

      <div className="mt-4 flex shrink-0 flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索企业名称、联系人、电话号码…"
          className="h-9 w-72 max-w-full rounded-md border bg-background px-2.5 text-sm"
        />
        <label className="flex items-center gap-2">
          <Checkbox checked={showDrafts} onCheckedChange={(v) => setShowDrafts(v === true)} />
          <span className="text-sm text-muted-foreground">显示草稿</span>
        </label>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-sm border border-border/60">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border/60 bg-muted/30 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">企业名称</th>
              <th className="px-3 py-2 font-medium">联系人</th>
              <th className="px-3 py-2 font-medium">电话号码</th>
              <th className="px-3 py-2 font-medium">问卷状态</th>
              <th className="px-3 py-2 font-medium">提交时间</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  {rows.length === 0 ? "暂无问卷数据。" : "没有符合条件的问卷。"}
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.token} className="border-b border-border/40 last:border-0">
                  <td className="px-3 py-2">
                    <Link
                      href={`/lawyer/checkups/lexcheck?view=report&token=${encodeURIComponent(row.token)}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {row.companyName?.trim() || "未填写公司名称"}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-foreground">{row.contactName?.trim() || "—"}</td>
                  <td className="px-3 py-2 text-foreground">{row.contactPhone?.trim() || "—"}</td>
                  <td className="px-3 py-2 text-foreground">
                    {row.status === "submitted" ? "已提交" : "草稿"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.submittedAt ? new Date(row.submittedAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
