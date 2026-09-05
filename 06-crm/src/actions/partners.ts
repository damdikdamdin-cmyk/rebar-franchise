"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PartnerStatus, StoreFormat, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isAdmin, isUk } from "@/lib/access";
import { LAUNCH_TASKS } from "@/lib/launch-template";
import { notifyUsers } from "@/lib/notify";
import { notifyTelegram } from "@/lib/telegram";
import { randomToken } from "@/lib/utils";

export async function updatePartner(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const own = user.role === "partner" && user.partnerId === id;
  if (!isUk(user.role) && !own) return;

  const data: Record<string, unknown> = {
    name: String(formData.get("name") ?? "").trim() || undefined,
    company: String(formData.get("company") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    telegramChat: String(formData.get("telegramChat") ?? "").trim() || null,
  };
  if (isUk(user.role)) {
    data.city = String(formData.get("city") ?? "").trim() || undefined;
    data.status = (String(formData.get("status") ?? "") as PartnerStatus) || undefined;
    data.format = (String(formData.get("format") ?? "") as StoreFormat) || undefined;
    const curator = String(formData.get("curatorUserId") ?? "");
    if (formData.has("curatorUserId")) data.curatorUserId = curator || null;
  }
  const before = await prisma.partner.findUnique({ where: { id } });
  const partner = await prisma.partner.update({ where: { id }, data });
  if (isUk(user.role) && partner.curatorUserId && partner.curatorUserId !== before?.curatorUserId) {
    await prisma.launchProject.updateMany({ where: { partnerId: id, status: "active" }, data: { curatorUserId: partner.curatorUserId } });
    await notifyUsers([partner.curatorUserId], `Вы куратор партнёра ${partner.city} · ${partner.name}`, undefined, `/partners/${id}`);
  }
  revalidatePath(`/partners/${id}`);
  revalidatePath("/partners");
}

export async function createPartnerInvite(formData: FormData) {
  const user = await requireUser();
  if (!isUk(user.role)) return;
  const partnerId = String(formData.get("partnerId") ?? "");
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  if (!partnerId || !email) return;
  const invite = await prisma.invite.create({
    data: { email, role: "partner", partnerId, token: randomToken(24), expiresAt: new Date(Date.now() + 14 * 86400000), createdById: user.id },
  });
  revalidatePath(`/partners/${partnerId}`);
  redirect(`/partners/${partnerId}?invite=${invite.token}`);
}

export async function createPartnerDirect(formData: FormData) {
  const user = await requireUser();
  if (!isAdmin(user.role)) return;
  const name = String(formData.get("name") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const format = (String(formData.get("format") ?? "standard") as StoreFormat) || "standard";
  const curatorUserId = String(formData.get("curatorUserId") ?? "") || null;
  if (!name || !city) return;
  const startedAt = new Date();
  const partner = await prisma.partner.create({
    data: { name, city, email: email || null, phone: String(formData.get("phone") ?? "").trim() || null, format, curatorUserId, signedAt: startedAt },
  });
  const store = await prisma.store.create({
    data: { name: `re:bar ${city}`, city, kind: "franchise", format, status: "launch", partnerId: partner.id },
  });
  await prisma.launchProject.create({
    data: {
      partnerId: partner.id,
      storeId: store.id,
      curatorUserId,
      startedAt,
      targetOpenAt: new Date(startedAt.getTime() + 75 * 86400000),
      tasks: { create: LAUNCH_TASKS.map((t, i) => ({ ...t, sortOrder: i })) },
    },
  });
  let token: string | null = null;
  if (email) {
    const invite = await prisma.invite.create({
      data: { email, role: "partner", partnerId: partner.id, token: randomToken(24), expiresAt: new Date(Date.now() + 14 * 86400000), createdById: user.id },
    });
    token = invite.token;
  }
  revalidatePath("/partners");
  redirect(`/partners/${partner.id}${token ? `?invite=${token}` : ""}`);
}

export async function setLaunchTaskStatus(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as TaskStatus;
  const comment = String(formData.get("comment") ?? "").trim();
  const task = await prisma.launchTask.findUnique({ where: { id }, include: { project: { include: { partner: true, store: true } } } });
  if (!task) return;
  const allowed = isUk(user.role) || (user.role === "partner" && user.partnerId === task.project.partnerId);
  if (!allowed) return;

  await prisma.launchTask.update({
    where: { id },
    data: { status, completedAt: status === "done" ? new Date() : null, comment: comment || task.comment },
  });

  const project = task.project;
  const remaining = await prisma.launchTask.count({ where: { projectId: project.id, status: { in: ["pending", "in_progress"] } } });
  if (remaining === 0 && project.status === "active") {
    await prisma.launchProject.update({ where: { id: project.id }, data: { status: "opened" } });
    await prisma.store.update({ where: { id: project.storeId }, data: { status: "open", openedAt: new Date() } });
    await prisma.partner.update({ where: { id: project.partnerId }, data: { status: "active" } });
  }

  // уведомляем противоположную сторону
  const recipients = new Set<string>();
  if (user.role === "partner") {
    if (project.curatorUserId) recipients.add(project.curatorUserId);
  } else {
    const partnerUsers = await prisma.user.findMany({ where: { partnerId: project.partnerId, role: "partner" }, select: { id: true } });
    partnerUsers.forEach((u) => recipients.add(u.id));
  }
  if (status === "done") {
    await notifyUsers(
      [...recipients],
      `${project.store.city}: шаг «${task.title}» закрыт`,
      user.name ?? undefined,
      `/launches/${project.id}`,
    );
    if (project.partner.telegramChat) {
      await notifyTelegram(`re:bar · ${project.store.city}\nШаг «${task.title}» закрыт (${user.name})`, project.partner.telegramChat);
    }
  }
  revalidatePath(`/launches/${project.id}`);
  revalidatePath("/launches");
}

export async function setLaunchDates(formData: FormData) {
  const user = await requireUser();
  if (!isUk(user.role)) return;
  const id = String(formData.get("id") ?? "");
  const startedAt = String(formData.get("startedAt") ?? "");
  const targetOpenAt = String(formData.get("targetOpenAt") ?? "");
  await prisma.launchProject.update({
    where: { id },
    data: {
      startedAt: startedAt ? new Date(startedAt) : undefined,
      targetOpenAt: targetOpenAt ? new Date(targetOpenAt) : null,
    },
  });
  revalidatePath(`/launches/${id}`);
}

export async function updateStore(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const store = await prisma.store.findUnique({ where: { id } });
  if (!store) return;
  const allowed = isUk(user.role) || (user.role === "partner" && user.partnerId === store.partnerId);
  if (!allowed) return;
  await prisma.store.update({
    where: { id },
    data: {
      name: String(formData.get("name") ?? "").trim() || undefined,
      address: String(formData.get("address") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
    },
  });
  revalidatePath(`/stores/${id}`);
  revalidatePath("/stores");
}
