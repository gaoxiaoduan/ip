import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Tooltip({
  children,
  className,
  label,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly label: string;
}) {
  return (
    <span className={cn("group/tooltip relative inline-flex", className)}>
      {children}
      <span
        className="pointer-events-none absolute top-full left-1/2 z-50 mt-2 -translate-x-1/2 whitespace-nowrap bg-ink px-2 py-1 text-[11px] leading-4 text-white opacity-0 shadow-none transition-opacity duration-150 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100"
        role="tooltip"
      >
        {label}
      </span>
    </span>
  );
}
