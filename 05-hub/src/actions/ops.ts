"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { LeadStage, StoreFormat, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { canAccessPipeline, canAccessTeam, assertStoreAccess, isUk } from "@/lib/access";
import { LAUNCH_TASKS } from "@/lib/launch-template";
import { notifyTelegram } from "@/lib/telegram";

async function requirePipelineUser() {
  const user = await requireUser();
  if (!canAccessPipeline(user.role)) redirect("/");
  return user;
}

export async function updateLeadStage(leadId: string, stage: LeadStage) {
  const user = await requirePipelineUser();
  await prisma.lead.update({
    where: { id: leadId },
    data: { stage },
  });
  await prisma.leadActivity.create({
    data: {
      leadId,
      type: "stage",
      body: `Стадия: ${stage}`,
      userId: user.id,
    },
  });
  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/${leadId}`);
}

export async function addLeadNote(formData: FormData) {
  const user = await requirePipelineUser();
  const leadId = String(formData.get("leadId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!leadId || !body) return;
  await prisma.leadActivity.create({
    data: { leadId, type: "note", body, userId: user.id },
  });
  revalidatePath(`/pipeline/${leadId}`);
}

export async function convertLead(formData: FormData) {
  const user = await requirePipelineUser();
  const leadId = String(formData.get("leadId") ?? "");
  const partnerName = String(formData.get("partnerName") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const format = String(formData.get("format") ?? "standard") as StoreFormat;
  if (!leadId || !partnerName || !city) return;

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return;

  const curator = await prisma.user.findFirst({ where: { role: "uk_curator" } });
  const curatorId = curator?.id ?? user.id;

  const partner = await prisma.partner.create({
    data: {
      name: partnerName,
      phone: lead.phone,
      email: null,
      city,
      status: "onboarding",
      format,
      signedAt: new Date(),
      curatorUserId: curatorId,
    },
  });

  const store = await prisma.store.create({
    data: {
      name: `re:bar ${city}`,
      city,
      kind: "franchise",
      format,
      status: "launch",
      partnerId: partner.id,
    },
  });

  const startedAt = new Date();
  const targetOpenAt = new Date();
  targetOpenAt.setDate(targetOpenAt.getDate() + 90);

  const project = await prisma.launchProject.create({
    data: {
      partnerId: partner.id,
      storeId: store.id,
      curatorUserId: curatorId,
      startedAt,
      targetOpenAt,
      status: "active",
    },
  });

  await prisma.launchTask.createMany({
    data: LAUNCH_TASKS.map((task, index) => ({
      projectId: project.id,
      code: task.code,
      title: task.title,
      phase: task.phase,
      ownerRole: task.ownerRole,
      dueOffsetDays: task.dueOffsetDays,
      sortOrder: index,
    })),
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: { stage: "paid", partnerId: partner.id },
  });
  await prisma.leadActivity.create({
    data: {
      leadId,
      type: "convert",
      body: `Партнёр создан: ${partnerName}. Запуск точки ${store.name}.`,
      userId: user.id,
    },
  });

  await notifyTelegram(`Оплата франшизы: ${partnerName}, ${city}. Запуск открыт.`);

  revalidatePath("/pipeline");
  revalidatePath("/partners");
  redirect(`/partners/${partner.id}/launch`);
}

export async function createCustomer(formData: FormData) {
  const user = await requireUser();
  const storeId = String(formData.get("storeId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!storeId || !name || !phone) return;

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store || !assertStoreAccess(user, store)) return;

  await prisma.customer.upsert({
    where: { storeId_phone: { storeId, phone } },
    update: { name, notes },
    create: { storeId, name, phone, notes },
  });
  revalidatePath(`/stores/${storeId}`);
}

export async function createSale(formData: FormData) {
  const user = await requireUser();
  const storeId = String(formData.get("storeId") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  const creditAmount = Number(formData.get("creditAmount") ?? 0);
  const note = String(formData.get("note") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim();
  const customerName = String(formData.get("customerName") ?? "").trim();
  if (!storeId || !amount || amount <= 0) return;

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store || !assertStoreAccess(user, store)) return;

  let customerId: string | null = null;
  if (phone) {
    const customer = await prisma.customer.upsert({
      where: { storeId_phone: { storeId, phone } },
      update: { name: customerName || undefined },
      create: { storeId, name: customerName || "Клиент", phone },
    });
    customerId = customer.id;
  }

  await prisma.sale.create({
    data: {
      storeId,
      customerId,
      sellerUserId: user.role === "seller" ? user.id : user.storeId === storeId ? user.id : null,
      amount: Math.round(amount),
      creditAmount: Math.max(0, Math.round(creditAmount || 0)),
      note,
      soldAt: new Date(),
    },
  });
  revalidatePath("/");
  revalidatePath("/stores");
  revalidatePath(`/stores/${storeId}`);
}

export async function updateLaunchTask(formData: FormData) {
  const user = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  const status = String(formData.get("status") ?? "") as TaskStatus;
  const comment = String(formData.get("comment") ?? "").trim() || null;
  if (!taskId || !status) return;

  const task = await prisma.launchTask.findUnique({
    where: { id: taskId },
    include: { project: { include: { store: true, partner: true } } },
  });
  if (!task) return;

  const store = task.project.store;
  const allowed =
    isUk(user.role) || (user.role === "partner" && store.partnerId === user.partnerId);
  if (!allowed) return;

  await prisma.launchTask.update({
    where: { id: taskId },
    data: {
      status,
      comment,
      completedAt: status === "done" ? new Date() : null,
    },
  });

  if (task.code === "open" && status === "done") {
    await prisma.store.update({
      where: { id: store.id },
      data: { status: "open", openedAt: new Date() },
    });
    await prisma.launchProject.update({
      where: { id: task.projectId },
      data: { status: "opened" },
    });
    await prisma.partner.update({
      where: { id: task.project.partnerId },
      data: { status: "active" },
    });
  }

  revalidatePath(`/partners/${task.project.partnerId}/launch`);
  revalidatePath(`/partners/${task.project.partnerId}`);
  revalidatePath("/partners");
  revalidatePath("/stores");
}

export async function createInvite(formData: FormData) {
  const user = await requireUser();
  if (!canAccessTeam(user.role)) redirect("/");

  const email = String(formData.get("email") ?? "")
    .toLowerCase()
    .trim();
  const role = String(formData.get("role") ?? "uk_sales") as
    | "uk_admin"
    | "uk_sales"
    | "uk_curator"
    | "partner"
    | "seller";
  const partnerId = String(formData.get("partnerId") ?? "") || null;
  const storeId = String(formData.get("storeId") ?? "") || null;
  if (!email) return;

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  await prisma.invite.create({
    data: {
      email,
      role,
      token,
      partnerId: partnerId === "__none__" ? null : partnerId,
      storeId: storeId === "__none__" ? null : storeId,
      expiresAt,
      createdById: user.id,
    },
  });
  revalidatePath("/settings/team");
}

export async function acceptInvite(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!token || !name || password.length < 6) {
    redirect(`/invite/${token}?error=1`);
  }

  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    redirect(`/invite/${token}?error=2`);
  }

  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email: invite.email },
    update: {
      name,
      passwordHash,
      role: invite.role,
      partnerId: invite.partnerId,
      storeId: invite.storeId,
    },
    create: {
      email: invite.email,
      name,
      passwordHash,
      role: invite.role,
      partnerId: invite.partnerId,
      storeId: invite.storeId,
    },
  });

  await prisma.invite.update({
    where: { id: invite.id },
    data: { usedAt: new Date() },
  });

  redirect("/login?invited=1");
}
