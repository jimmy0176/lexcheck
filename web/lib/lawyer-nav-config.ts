/**
 * 法律体检应用的二级导航项，供左侧共享导航栏在任意一级应用页面下都能展示完整子项
 * （而不仅仅在法律体检自己的页面上），配合 openKeys 持久化，使已展开的一级标题
 * 在切换到其他一级应用时不会因为"这一页压根没有子项数据"而被迫收拢。
 */
export const LEXCHECK_NAV_ITEMS: Array<{ view: string; label: string }> = [
  { view: "dashboard", label: "总览" },
  { view: "report", label: "报告制作" },
  { view: "questionnaire-config", label: "问卷管理" },
  { view: "prompt-config", label: "AI配置" },
];
