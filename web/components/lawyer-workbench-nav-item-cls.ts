/**
 * 与一级/二级导航项完全一致的样式，供侧栏底部的"大模型设置""后台管理"等账号级入口复用，保持间距/字号统一。
 * 独立成纯函数文件（不带 "use client"），因为它同时被 Server Component（LawyerWorkbenchSidebar）
 * 和 Client Component（LawyerWorkbenchNav）调用——放在 "use client" 模块里会导致 Server Component
 * 报错"不能从服务端调用客户端函数"。
 */
export function workbenchNavItemCls(active: boolean) {
  return `block rounded-md px-3 py-2 text-base transition-colors ${
    active ? "bg-sidebar-accent text-white" : "text-white/60 hover:bg-sidebar-accent hover:text-white"
  }`;
}
