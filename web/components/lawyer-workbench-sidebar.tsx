import Link from "next/link";
import { WorkspaceSidePanel, WorkspaceSidePanelSection } from "@/components/workspace-side-panel";
import { LawyerWorkbenchNav, type LawyerWorkbenchNavGroup } from "@/components/lawyer-workbench-nav";
import { workbenchNavItemCls } from "@/components/lawyer-workbench-nav-item-cls";
import { getAppVersion } from "@/lib/app-version";

/**
 * 律师工作台统一左栏：品牌区 + 总导航 + 账号级入口（帮助与支持、大模型设置、仅管理员可见的后台管理）。
 * 三个一级应用（以及后台管理页）共用同一份代码，避免样式各自漂移。
 * 这几个账号级入口与一级/二级导航项同属一个不分割的区块（没有 divide-y 边框线），
 * 但用 flex-col + shrink-0 固定贴在这个区块的最下方，导航列表本身可滚动，样式间距与导航项一致。
 */
export function LawyerWorkbenchSidebar({
  groups,
  isAdmin,
  className,
  helpCenterActive = false,
  llmSettingsActive = false,
}: {
  groups: LawyerWorkbenchNavGroup[];
  isAdmin: boolean;
  className?: string;
  helpCenterActive?: boolean;
  llmSettingsActive?: boolean;
}) {
  const { label: versionLabel } = getAppVersion();

  return (
    <WorkspaceSidePanel className={className}>
      <WorkspaceSidePanelSection>
        <Link
          href="/"
          className="font-heading text-3xl font-semibold leading-none tracking-[0.06em] text-white transition-opacity hover:opacity-80"
        >
          HE Partners
        </Link>
      </WorkspaceSidePanelSection>

      <WorkspaceSidePanelSection className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <LawyerWorkbenchNav groups={groups} />
        </div>
        <div className="shrink-0 space-y-1 pt-1">
          <Link href="/lawyer/checkups/lexcheck?view=help" className={workbenchNavItemCls(helpCenterActive)}>
            帮助与支持
          </Link>
          <Link href="/lawyer/checkups/lexcheck?view=llm-settings" className={workbenchNavItemCls(llmSettingsActive)}>
            大模型设置
          </Link>
          {isAdmin ? (
            <Link href="/lawyer/admin" className={workbenchNavItemCls(false)}>
              后台管理
            </Link>
          ) : null}
          <div className="px-3 pt-1 text-xs text-white/35">{versionLabel}</div>
        </div>
      </WorkspaceSidePanelSection>
    </WorkspaceSidePanel>
  );
}
