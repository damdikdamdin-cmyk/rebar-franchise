"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { LeadStage, StoreFormat } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { canAccessPipeline, isAdmin } from "@/lib/access";
import { LEAD_STAGE_LABEL } from "@/lib/format";
import { LAUNCH_TASKS } from "@/lib/launch-template";
import { notifyUsers } from "@/lib/notify";
import { notifyTelegram } from "@/lib/telegram";
import { randomToken } from "@/lib/utils";

async function guard() {
  const user = await requireUser();
  if (!canAccessPipeline(user.role)) redirect("/");
  return user;
}

export async function createLead(formData: FormData) {
  const user = await guard();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!name || !phone) return;
  const lead = await prisma.lead.create({
    data: {
      name,
      phone,
      email: String(formData.get("email") ?? "").trim() || null,
      city: String(formData.get("city") ?? "").trim() || null,
      note: String(formData.get("note") ?? "").trim() || null,
      source: String(formData.get("source") ?? "manual").trim() || "manual",
      budget: Number(formData.get("budget")) || null,
      format: (String(formData.get("format") ?? "") as StoreFormat) || null,
      ownerUserId: user.id,
    },
  });
  await prisma.leadActivity.create({ data: { leadId: lead.id, type: "note", body: "Лид создан вручную", userId: user.id } });
  revalidatePath("/pipeline");
  redirect(`/pipeline/${lead.id}`);
}

export async function moveLead(formData: FormData) {
  const user = await guard();
  const id = String(formData.get("id") ?? "");
  const stage = String(formData.get("stage") ?? "") as LeadStage;
  if (!LEAD_STAGE_LABEL[stage]) return;
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead || lead.stage === stage) return;
  await prisma.lead.update({ where: { id }, data: { stage } });
  await prisma.leadActivity.create({
    data: { leadId: id, type: "stage", body: `${LEAD_STAGE_LABEL[lead.stage]} → ${LEAD_STAGE_LABEL[stage]}`, userId: user.id },
  });
  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/${id}`);
}

export async function updateLead(formData: FormData) {
  const user = await guard();
  const id = String(formData.get("id") ?? "");
  const nextStep = String(formData.get("nextStepAt") ?? "");
  await prisma.lead.update({
    where: { id },
    data: {
      name: String(formData.get("name") ?? "").trim() || undefined,
      phone: String(formData.get("phone") ?? "").trim() || undefined,
      email: String(formData.get("email") ?? "").trim() || null,
      city: String(formData.get("city") ?? "").trim() || null,
      budget: Number(formData.get("budget")) || null,
      format: (String(formData.get("format") ?? "") as StoreFormat) || null,
      ownerUserId: String(formData.get("ownerUserId") ?? "") || null,
      nextStepAt: nextStep ? new Date(nextStep) : null,
      note: String(formData.get("note") ?? "").trim() || null,
    },
  });
  await prisma.leadActivity.create({ data: { leadId: id, type: "edit", body: "Карточка обновлена", userId: user.id } });
  revalidatePath(`/pipeline/${id}`);
}

export async function addLeadActivity(formData: FormData) {
  const user = await guard();
  const leadId = String(formData.get("leadId") ?? "");
  const type = String(formData.get("type") ?? "note");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  await prisma.leadActivity.create({ data: { leadId, type, body, userId: user.id } });
  await prisma.lead.update({ where: { id: leadId }, data: { updatedAt: new Date() } });
  revalidatePath(`/pipeline/${leadId}`);
}

/**
 * Лид на стадии «Оплата» → партнёр + точка (launch) + проект запуска + инвайт.
 */
export async function convertLeadToPartner(formData: FormData) {
  const user = await guard();
  const leadId = String(formData.get("leadId") ?? "");
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return;
  if (lead.partnerId) redirect(`/partners/${lead.partnerId}`);

  const email = String(formData.get("email") ?? lead.email ?? "").toLowerCase().trim();
  const city = String(formData.get("city") ?? lead.city ?? "").trim();
  const format = (String(formData.get("format") ?? lead.format ?? "standard") as StoreFormat) || "standard";
  const curatorUserId = String(formData.get("curatorUserId") ?? "") || null;
  const company = String(formData.get("company") ?? "").trim() || null;
  if (!email || !city) redirect(`/pipeline/${leadId}?error=convert`);

  const startedAt = new Date();
  const partner = await prisma.partner.create({
    data: {
      name: lead.name,
      company,
      phone: lead.phone,
      email,
      city,
      format,
      status: "onboarding",
      signedAt: startedAt,
      curatorUserId,
    },
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
  const invite = await prisma.invite.create({
    data: {
      email,
      role: "partner",
      partnerId: partner.id,
      token: randomToken(24),
      expiresAt: new Date(Date.now() + 14 * 86400000),
      createdById: user.id,
    },
  });
  await prisma.lead.update({ where: { id: leadId }, data: { stage: "paid", partnerId: partner.id } });
  await prisma.leadActivity.create({
    data: { leadId, type: "convert", body: `Подключён как партнёр: ${city}. Инвайт отправлен на ${email}`, userId: user.id },
  });

  const watchers = await prisma.user.findMany({
    where: { OR: [{ role: { in: ["founder", "uk_admin"] } }, { id: curatorUserId ?? "__none__" }] },
    select: { id: true },
  });
  await notifyUsers(
    watchers.map((w) => w.id),
    `Новый партнёр: ${city} · ${lead.name}`,
    curatorUserId ? "Назначен куратор, проект запуска создан" : "Куратор не назначен — назначьте в карточке партнёра",
    `/partners/${partner.id}`,
  );
  await notifyTelegram(`re:bar OS · новый партнёр\n${lead.name} · ${city}\nИнвайт: ${process.env.APP_URL ?? ""}/join/${invite.token}`);

  revalidatePath("/pipeline");
  revalidatePath("/partners");
  redirect(`/partners/${partner.id}?invite=${invite.token}`);
}

export async function deleteLead(formData: FormData) {
  const user = await guard();
  if (!isAdmin(user.role)) return;
  const id = String(formData.get("id") ?? "");
  await prisma.lead.delete({ where: { id } });
  revalidatePath("/pipeline");
  redirect("/pipeline");
}
