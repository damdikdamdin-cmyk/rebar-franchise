import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { assertStoreAccess } from "@/lib/access";
import { StoreShellClient } from "@/components/store-shell-client";

export default async function StoreLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const store = await prisma.store.findUnique({ where: { id } });
  if (!store) notFound();
  if (!assertStoreAccess(user, store)) redirect("/");

  return (
    <StoreShellClient storeId={store.id} storeName={store.name} city={store.city}>
      {children}
    </StoreShellClient>
  );
}
