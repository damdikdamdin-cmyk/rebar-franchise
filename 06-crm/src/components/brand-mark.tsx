import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Логотип re:bar с равным зазором вокруг двоеточия. */
export function BrandMark({
  className,
  after,
}: {
  className?: string;
  after?: ReactNode;
}) {
  return (
    <span className={cn("font-serif tracking-tight", className)}>
      re
      <span className="brand-colon" aria-hidden="true">
        :
      </span>
      bar
      {after}
    </span>
  );
}
