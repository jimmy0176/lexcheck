import Link from "next/link";

export type DashboardRow = {
  token: string;
  companyName: string | null;
  contactName: string | null;
  contactPhone: string | null;
  status: "draft" | "submitted";
  savedAt: Date;
  submittedAt: Date | null;
};

export type DashboardStats = {
  total: number;
  notSubmitted: number;
  submittedNotMade: number;
  madeNotConfirmed: number;
  confirmed: number;
};

const FUNNEL_SEGMENTS = [
  { key: "notSubmitted", label: "未提交", color: "bg-muted-foreground/25" },
  { key: "submittedNotMade", label: "已提交未制作", color: "bg-primary/35" },
  { key: "madeNotConfirmed", label: "已制作未反馈", color: "bg-primary/65" },
  { key: "confirmed", label: "已反馈（办结）", color: "bg-emerald-500" },
] as const;

export function Dashboard({ stats, rows }: { stats: DashboardStats; rows: DashboardRow[] }) {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="shrink-0">
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">仪表盘</h1>
          <span className="text-sm text-muted-foreground">已发放 {stats.total} 份问卷</span>
        </div>

        <div className="mt-4">
          <div className="flex h-3 w-full overflow-hidden rounded-sm border border-border/60">
            {FUNNEL_SEGMENTS.map((seg) => {
              const count = stats[seg.key];
              const pct = stats.total === 0 ? 0 : (count / stats.total) * 100;
              if (pct === 0) return null;
              return <div key={seg.key} className={seg.color} style={{ width: `${pct}%` }} />;
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {FUNNEL_SEGMENTS.map((seg) => (
              <div key={seg.key} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${seg.color}`} />
                <span className="text-muted-foreground">{seg.label}</span>
                <span className="font-medium text-foreground">{stats[seg.key]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto rounded-sm border border-border/60">
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
