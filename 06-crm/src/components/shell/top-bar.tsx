import Link from "next/link";
import type { ReactNode } from "react";

export function TopBar({ children }: { children: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-8">
      <Link href="/" className="display text-xl lg:hidden">
        re:bar
      </Link>
      <div className="flex flex-1 items-center gap-2">{children}</div>
    </header>
  );
}
