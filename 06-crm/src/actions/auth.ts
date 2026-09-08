"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { randomToken } from "@/lib/utils";
import { enrollByRole } from "@/lib/learning";
import { notifyUsers } from "@/lib/notify";
import { UK_ROLES } from "@/lib/access";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "/");
  try {
    await signIn("credentials", { email, password, redirectTo: callbackUrl.startsWith("/") ? callbackUrl : "/" });
  } catch (error) {
    if (error instanceof AuthError) redirect("/login?error=1");
    throw error;
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function acceptInvite(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const password = String(formData.get("password") ?? "");
  if (!token || !name || password.length < 6) redirect(`/join/${token}?error=1`);

  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) redirect("/join/expired");

  const passwordHash = await bcrypt.hash(password, 10);
  const email = invite.email.toLowerCase();
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      phone,
      passwordHash,
      role: invite.role,
      partnerId: invite.partnerId,
      storeId: invite.storeId,
      accessRoleId: invite.accessRoleId,
    },
    create: {
      email,
      name,
      phone,
      passwordHash,
      role: invite.role,
      partnerId: invite.partnerId,
      storeId: invite.storeId,
      accessRoleId: invite.accessRoleId,
    },
  });
  await prisma.invite.update({ where: { id: invite.id }, data: { usedAt: new Date() } });
  await enrollByRole(user.id, user.role);

  const { writeChangeLog } = await import("@/lib/audit");
  await writeChangeLog({
    storeId: invite.storeId,
    userId: user.id,
    entityType: "user",
    entityId: user.id,
    action: "register",
    summary: `${name} зарегистрировался по приглашению (${invite.role})`,
  });

  if (invite.role === "partner" && invite.partnerId) {
    const partner = await prisma.partner.findUnique({ where: { id: invite.partnerId } });
    const admins = await prisma.user.findMany({
      where: { OR: [{ role: { in: ["founder", "uk_admin"] } }, { id: partner?.curatorUserId ?? "__none__" }] },
      select: { id: true },
    });
    await notifyUsers(
      admins.map((a) => a.id),
      `Партнёр ${name} создал аккаунт`,
      partner ? `${partner.city} · ${partner.name}` : undefined,
      partner ? `/partners/${partner.id}` : "/partners",
    );
  }

  try {
    const home =
      user.role === "partner"
        ? "/onboarding"
        : user.storeId
          ? `/stores/${user.storeId}/pos`
          : "/";
    await signIn("credentials", { email, password, redirectTo: home });
  } catch (error) {
    if (error instanceof AuthError) redirect("/login?invited=1");
    throw error;
  }
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const token = randomToken(24);
    await prisma.passwordReset.create({
      data: { userId: user.id, token, expiresAt: new Date(Date.now() + 2 * 3600_000) },
    });
    // Почтового транспорта нет: ссылку получает админ УК через инбокс и передаёт лично.
    const admins = await prisma.user.findMany({ where: { role: { in: UK_ROLES.slice(0, 2) } }, select: { id: true } });
    await notifyUsers(
      admins.map((a) => a.id),
      `Сброс пароля: ${user.name}`,
      `Передайте ссылку пользователю ${user.email}`,
      `/reset/${token}`,
    );
  }
  redirect("/reset?sent=1");
}

export async function performPasswordReset(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) redirect(`/reset/${token}?error=1`);
  const reset = await prisma.passwordReset.findUnique({ where: { token }, include: { user: true } });
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) redirect("/reset?expired=1");
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } });
  await prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } });
  redirect("/login?reset=1");
}
