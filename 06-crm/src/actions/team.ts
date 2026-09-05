"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ALL_ROLES, canInviteToPartner, canManageTeam, isAdmin, UK_ROLES } from "@/lib/access";
import { randomToken } from "@/lib/utils";

export async function createInvite(formData: FormData) {
  const user = await requireUser();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const role = String(formData.get("role") ?? "") as Role;
  let partnerId = String(formData.get("partnerId") ?? "") || null;
  const storeId = String(formData.get("storeId") ?? "") || null;

  if (!email || !ALL_ROLES.includes(role)) return;

  if (!canManageTeam(user.role)) {
    // Партнёр и куратор приглашают только в контур партнёра и только не-УК роли
    if (UK_ROLES.includes(role)) redirect("/team?error=role");
    if (user.role === "partner") {
      partnerId = user.partnerId;
      if (storeId) {
        const store = await prisma.store.findUnique({ where: { id: storeId } });
        if (!store || store.partnerId !== user.partnerId) redirect("/team?error=store");
      }
    } else if (user.role === "uk_curator") {
      if (!partnerId || !canInviteToPartner(user, partnerId)) redirect("/team?error=partner");
    } else {
      redirect("/");
    }
  }

  if (storeId && !partnerId) {
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    partnerId = store?.partnerId ?? null;
  }

  await prisma.invite.create({
    data: {
      email,
      role,
      partnerId,
      storeId,
      token: randomToken(24),
      expiresAt: new Date(Date.now() + 14 * 86400000),
      createdById: user.id,
    },
  });
  revalidatePath("/team");
}

export async function revokeInvite(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const invite = await prisma.invite.findUnique({ where: { id } });
  if (!invite) return;
  const allowed = isAdmin(user.role) || invite.createdById === user.id;
  if (!allowed) return;
  await prisma.invite.update({ where: { id }, data: { usedAt: new Date(), expiresAt: new Date() } });
  revalidatePath("/team");
}

export async function updateMemberRole(formData: FormData) {
  const user = await requireUser();
  if (!isAdmin(user.role)) return;
  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "") as Role;
  if (!ALL_ROLES.includes(role) || id === user.id) return;
  await prisma.user.update({ where: { id }, data: { role } });
  revalidatePath("/team");
}
