"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { workbenchNavItemCls } from "./lawyer-workbench-nav-item-cls";

const OPEN_GROUPS_STORAGE_KEY = "lexcheck:workbench-nav:open-groups";

function readStoredOpenKeys(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(OPEN_GROUPS_STORAGE_KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeStoredOpenKeys(keys: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(OPEN_GROUPS_STORAGE_KEY, JSON.stringify([...keys]));
}

export type LawyerWorkbenchNavChild = {
  key: string;
  label: string;
  href: string;
  active: boolean;
};

export type LawyerWorkbenchNavGroup = {
  key: string;
  label: string;
  href?: string;
  active: boolean;
  children: LawyerWorkbenchNavChild[];
};

const childItemCls = workbenchNavItemCls;

export function LawyerWorkbenchNav({ groups }: { groups: LawyerWorkbenchNavGroup[] }) {
  const [openKeys, setOpenKeys] = useState<Set<string>>(
    () => new Set(groups.filter((g) => g.active).map((g) => g.key))
  );

  useEffect(() => {
    // 首屏按服务端渲染结果（仅展开当前分组）保持一致，避免水合不一致；挂载后再合并本地存储的展开状态。
    // 合并结果要立刻写回存储：否则"仅因 active 而展开、从未手动点击过"的分组不会被记住，
    // 下次导航到别的一级应用时就会看起来"收拢了"。
    const stored = readStoredOpenKeys();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenKeys((prev) => {
      const merged = new Set([...prev, ...stored]);
      writeStoredOpenKeys(merged);
      return merged;
    });
  }, []);

  function toggle(key: string) {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      writeStoredOpenKeys(next);
      return next;
    });
  }

  return (
    <nav className="space-y-1">
      {groups.map((group) => {
        if (group.children.length === 0) {
          return (
            <Link key={group.key} href={group.href ?? "#"} className={childItemCls(group.active)}>
              {group.label}
            </Link>
          );
        }

        const isOpen = openKeys.has(group.key);
        return (
          <div
            key={group.key}
            className={`rounded-md transition-colors ${isOpen ? "bg-sidebar-accent/25" : ""}`}
          >
            <button
              type="button"
              onClick={() => toggle(group.key)}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-base transition-colors ${
                isOpen
                  ? "text-white"
                  : "text-white/60 hover:bg-sidebar-accent hover:text-white"
              }`}
            >
              <span>{group.label}</span>
              <ChevronRight
                className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
              />
            </button>
            {isOpen ? (
              <div className="space-y-1 px-2 pb-2">
                {group.children.map((child) => (
                  <Link key={child.key} href={child.href} className={childItemCls(child.active)}>
                    {child.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
