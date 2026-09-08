import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import type { PermissionKey, UserWithAccess } from "@/lib/permissions";
import { can } from "@/lib/permissions";

/** Сессия + шаблон AccessRole для проверок can(). */
export async function requireUserWithAccess(): Promise<UserWithAccess> {
  const user = await requireUser();
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { accessRole: { select: { permissions: true } } },
  });
  return { ...user, accessRole: row?.accessRole ?? null };
}

export async function assertPermission(key: PermissionKey, redirectTo = "/") {
  const user = await requireUserWithAccess();
  if (!can(user, key)) redirect(redirectTo);
  return user;
}
