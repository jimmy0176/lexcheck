import Link from "next/link";
import type { DashboardRow } from "./Dashboard";

export function ReportQuestionnairePicker({ rows }: { rows: DashboardRow[] }) {
  return (
    <div className="flex h-full flex-col overflow-y-auto px-8 py-4">
      <h1 className="shrink-0 text-2xl font-semibold tracking-tight">选择问卷</h1>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-sm border border-border/60">
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
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  暂无问卷数据。
                </td>
              </tr>
            ) : (
              rows.map((row) => (
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
                    {row.submittedAt ? row.submittedAt.toLocaleString() : "—"}
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
