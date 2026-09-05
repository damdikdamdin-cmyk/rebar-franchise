"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { StoreShell } from "@/components/store-shell";

export function StoreShellClient({
  storeId,
  storeName,
  city,
  children,
}: {
  storeId: string;
  storeName: string;
  city: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <StoreShell storeId={storeId} storeName={storeName} city={city} pathname={pathname}>
      {children}
    </StoreShell>
  );
}
