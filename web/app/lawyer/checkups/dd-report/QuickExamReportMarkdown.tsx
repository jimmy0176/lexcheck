"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

type Props = {
  markdown: string;
  className?: string;
};

const mdComponents: Components = {
  h1: ({ className, ...props }) => (
    <h1 className={cn("mt-4 text-xl font-semibold tracking-tight first:mt-0", className)} {...props} />
  ),
  h2: ({ className, ...props }) => (
    <h2 className={cn("mt-4 text-lg font-semibold first:mt-0", className)} {...props} />
  ),
  h3: ({ className, ...props }) => (
    <h3 className={cn("mt-3 text-base font-semibold first:mt-0", className)} {...props} />
  ),
  h4: ({ className, ...props }) => (
    <h4 className={cn("mt-3 text-sm font-semibold first:mt-0", className)} {...props} />
  ),
  p: ({ className, ...props }) => (
    <p className={cn("my-2 text-sm leading-relaxed text-foreground", className)} {...props} />
  ),
  ul: ({ className, ...props }) => (
    <ul className={cn("my-2 list-disc pl-5 text-sm leading-relaxed", className)} {...props} />
  ),
  ol: ({ className, ...props }) => (
    <ol className={cn("my-2 list-decimal pl-5 text-sm leading-relaxed", className)} {...props} />
  ),
  li: ({ className, ...props }) => <li className={cn("my-0.5", className)} {...props} />,
  strong: ({ className, ...props }) => (
    <strong className={cn("font-semibold text-foreground", className)} {...props} />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn("my-2 border-l-2 border-primary/40 pl-3 text-sm text-muted-foreground", className)}
      {...props}
    />
  ),
  hr: ({ className, ...props }) => (
    <hr className={cn("my-4 border-border", className)} {...props} />
  ),
  pre: ({ className, ...props }) => (
    <pre
      className={cn(
        "my-3 overflow-x-auto rounded-md border border-border bg-muted/40 p-3 text-xs",
        className
      )}
      {...props}
    />
  ),
  code: ({ className, children, ...props }) => {
    const block = /language-/.test(String(className ?? ""));
    if (block) {
      return (
        <code className={cn("font-mono text-foreground", className)} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className={cn("rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground", className)}
        {...props}
      >
        {children}
      </code>
    );
  },
  table: ({ className, ...props }) => (
    <div className="my-3 w-full overflow-x-auto rounded-md border border-border">
      <table className={cn("w-full min-w-[32rem] border-collapse text-sm", className)} {...props} />
    </div>
  ),
  thead: ({ className, ...props }) => (
    <thead className={cn("bg-muted/60", className)} {...props} />
  ),
  tbody: ({ className, ...props }) => <tbody className={cn("", className)} {...props} />,
  tr: ({ className, ...props }) => (
    <tr className={cn("border-b border-border last:border-b-0", className)} {...props} />
  ),
  th: ({ className, ...props }) => (
    <th
      className={cn(
        "border border-border px-3 py-2 text-left text-xs font-semibold text-foreground",
        className
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }) => (
    <td className={cn("border border-border px-3 py-2 align-top text-xs leading-relaxed", className)} {...props} />
  ),
};

/**
 * 快速体检报告正文：GFM（含表格）渲染，提升可读性。
 */
export function QuickExamReportMarkdown({ markdown, className }: Props) {
  return (
    <div className={cn("text-foreground", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
