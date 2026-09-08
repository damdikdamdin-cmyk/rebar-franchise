"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ALL_ROLES, canInviteToPartner, canManageTeam, isAdmin, isUk, STORE_ROLES, UK_ROLES } from "@/lib/access";
import { randomToken } from "@/lib/utils";
import { writeChangeLog } from "@/lib/audit";
import { ensureSystemAccessRoles } from "@/lib/access-roles";
import { PERMISSION_KEYS, serializePermissions, type PermissionMap } from "@/lib/permissions";

function canEditAccessRoles(role: Role) {
  return isAdmin(role) || role === "uk_curator" || role === "partner" || role === "store_manager";
}

function permissionsFromForm(formData: FormData): PermissionMap {
  const map: PermissionMap = {};
  for (const key of PERMISSION_KEYS) {
    map[key] = formData.get(`perm_${key}`) === "on";
  }
  return map;
}

export async function createInvite(formData: FormData) {
  const user = await requireUser();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const nameHint = String(formData.get("name") ?? formData.get("nameHint") ?? "").trim() || null;
  const role = String(formData.get("role") ?? "") as Role;
  let partnerId = String(formData.get("partnerId") ?? "") || null;
  const storeId = String(formData.get("storeId") ?? "") || null;
  const accessRoleId = String(formData.get("accessRoleId") ?? "") || null;
  const returnTo = String(formData.get("returnTo") ?? "/team");

  if (!email || !ALL_ROLES.includes(role)) return;

  if (!canManageTeam(user.role) && user.role !== "store_manager") {
    if (UK_ROLES.includes(role)) redirect(`${returnTo}?error=role`);
    if (user.role === "partner") {
      partnerId = user.partnerId;
      if (storeId) {
        const store = await prisma.store.findUnique({ where: { id: storeId } });
        if (!store || store.partnerId !== user.partnerId) redirect(`${returnTo}?error=store`);
      }
    } else if (user.role === "uk_curator") {
      if (!partnerId || !canInviteToPartner(user, partnerId)) redirect(`${returnTo}?error=partner`);
    } else {
      redirect("/");
    }
  } else if (user.role === "store_manager") {
    if (!STORE_ROLES.includes(role)) redirect(`${returnTo}?error=role`);
    if (!storeId || storeId !== user.storeId) redirect(`${returnTo}?error=store`);
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    partnerId = store?.partnerId ?? null;
  }

  if (storeId && !partnerId) {
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    partnerId = store?.partnerId ?? null;
  }

  if (accessRoleId) {
    const ar = await prisma.accessRole.findUnique({ where: { id: accessRoleId } });
    if (!ar || (ar.storeId && ar.storeId !== storeId && !ar.system)) {
      redirect(`${returnTo}?error=role`);
    }
  }

  const invite = await prisma.invite.create({
    data: {
      email,
      nameHint,
      role,
      accessRoleId,
      partnerId,
      storeId,
      token: randomToken(24),
      expiresAt: new Date(Date.now() + 14 * 86400000),
      createdById: user.id,
    },
  });

  await writeChangeLog({
    storeId,
    userId: user.id,
    entityType: "invite",
    entityId: invite.id,
    action: "create",
    summary: `${user.name ?? "Админ"} пригласил ${nameHint ?? email} (${role})`,
  });

  revalidatePath("/team");
  if (storeId) {
    revalidatePath(`/stores/${storeId}/schedule`);
    revalidatePath(`/stores/${storeId}/audit`);
  }
  if (returnTo !== "/team") redirect(`${returnTo}?invited=1`);
}

export async function revokeInvite(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const invite = await prisma.invite.findUnique({ where: { id } });
  if (!invite) return;
  const allowed = isAdmin(user.role) || invite.createdById === user.id || user.role === "store_manager";
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
  const before = await prisma.user.findUnique({ where: { id } });
  await prisma.user.update({ where: { id }, data: { role } });
  await writeChangeLog({
    storeId: before?.storeId,
    userId: user.id,
    entityType: "user",
    entityId: id,
    action: "role_change",
    summary: `${user.name ?? "Админ"} сменил системную роль ${before?.name ?? id}: ${before?.role} → ${role}`,
    field: "role",
    oldValue: before?.role ?? null,
    newValue: role,
  });
  revalidatePath("/team");
}

export async function assignAccessRole(formData: FormData) {
  const user = await requireUser();
  if (!canEditAccessRoles(user.role)) redirect("/team?error=role");
  const id = String(formData.get("id") ?? "");
  const accessRoleId = String(formData.get("accessRoleId") ?? "") || null;
  const member = await prisma.user.findUnique({ where: { id } });
  if (!member) return;

  if (user.role === "store_manager" && member.storeId !== user.storeId) redirect("/team?error=store");
  if (user.role === "partner" && member.partnerId !== user.partnerId) redirect("/team?error=partner");

  const role = accessRoleId ? await prisma.accessRole.findUnique({ where: { id: accessRoleId } }) : null;
  await prisma.user.update({ where: { id }, data: { accessRoleId } });
  await writeChangeLog({
    storeId: member.storeId,
    userId: user.id,
    entityType: "user",
    entityId: id,
    action: "access_role",
    summary: `${user.name ?? "Админ"} назначил шаблон прав «${role?.name ?? "по умолчанию"}» сотруднику ${member.name}`,
    field: "accessRoleId",
    oldValue: member.accessRoleId,
    newValue: accessRoleId,
  });
  revalidatePath("/team");
  if (member.storeId) revalidatePath(`/stores/${member.storeId}/audit`);
}

export async function upsertAccessRole(formData: FormData) {
  const user = await requireUser();
  if (!canEditAccessRoles(user.role)) redirect("/team?error=role");
  await ensureSystemAccessRoles();

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const homePage = String(formData.get("homePage") ?? "/pos").trim() || "/pos";
  const storeId = String(formData.get("storeId") ?? "") || null;
  const permissions = permissionsFromForm(formData);
  if (!name) redirect("/team/roles?error=name");

  if (user.role === "store_manager") {
    if (!user.storeId || (storeId && storeId !== user.storeId)) redirect("/team?error=store");
  }

  const payload = {
    name,
    homePage,
    storeId: user.role === "store_manager" ? user.storeId : storeId,
    permissions: serializePermissions(permissions),
  };

  if (id) {
    const existing = await prisma.accessRole.findUnique({ where: { id } });
    if (!existing) redirect("/team/roles");
    if (existing.system && !isAdmin(user.role) && !isUk(user.role)) {
      // локальная копия системного пресета
      const copy = await prisma.accessRole.create({
        data: { ...payload, system: false },
      });
      await writeChangeLog({
        storeId: copy.storeId,
        userId: user.id,
        entityType: "access_role",
        entityId: copy.id,
        action: "create",
        summary: `${user.name ?? "Админ"} создал роль «${copy.name}» на основе пресета`,
      });
      revalidatePath("/team");
      revalidatePath("/team/roles");
      redirect(`/team/roles?edit=${copy.id}`);
    }
    await prisma.accessRole.update({ where: { id }, data: payload });
    await writeChangeLog({
      storeId: payload.storeId,
      userId: user.id,
      entityType: "access_role",
      entityId: id,
      action: "update",
      summary: `${user.name ?? "Админ"} обновил права роли «${name}»`,
    });
  } else {
    const created = await prisma.accessRole.create({
      data: { ...payload, system: false },
    });
    await writeChangeLog({
      storeId: created.storeId,
      userId: user.id,
      entityType: "access_role",
      entityId: created.id,
      action: "create",
      summary: `${user.name ?? "Админ"} создал роль «${created.name}»`,
    });
  }

  revalidatePath("/team");
  revalidatePath("/team/roles");
  redirect("/team/roles");
}

export async function deleteAccessRole(formData: FormData) {
  const user = await requireUser();
  if (!canEditAccessRoles(user.role)) return;
  const id = String(formData.get("id") ?? "");
  const role = await prisma.accessRole.findUnique({ where: { id } });
  if (!role || role.system) return;
  await prisma.user.updateMany({ where: { accessRoleId: id }, data: { accessRoleId: null } });
  await prisma.accessRole.delete({ where: { id } });
  await writeChangeLog({
    storeId: role.storeId,
    userId: user.id,
    entityType: "access_role",
    entityId: id,
    action: "delete",
    summary: `${user.name ?? "Админ"} удалил роль «${role.name}»`,
  });
  revalidatePath("/team");
  revalidatePath("/team/roles");
}
