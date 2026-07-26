import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function MonoLabel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "font-mono text-xs leading-4 tracking-normal text-mute",
        className,
      )}
    >
      {children}
    </span>
  );
}
