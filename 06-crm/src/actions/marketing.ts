"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CampaignStatus, ContentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { canAccessMarketing } from "@/lib/access";

async function guard() {
  const user = await requireUser();
  if (!canAccessMarketing(user.role)) redirect("/");
  return user;
}

export async function createContentItem(formData: FormData) {
  const user = await guard();
  const title = String(formData.get("title") ?? "").trim();
  const publishAt = String(formData.get("publishAt") ?? "");
  if (!title || !publishAt) return;
  await prisma.contentItem.create({
    data: {
      title,
      channel: String(formData.get("channel") ?? "Telegram"),
      rubric: String(formData.get("rubric") ?? "").trim() || null,
      body: String(formData.get("body") ?? "").trim() || null,
      publishAt: new Date(publishAt),
      status: (String(formData.get("status") ?? "idea") as ContentStatus) || "idea",
      campaignId: String(formData.get("campaignId") ?? "") || null,
      authorId: user.id,
    },
  });
  revalidatePath("/marketing");
}

export async function setContentStatus(formData: FormData) {
  await guard();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as ContentStatus;
  await prisma.contentItem.update({ where: { id }, data: { status } });
  revalidatePath("/marketing");
}

export async function deleteContentItem(formData: FormData) {
  await guard();
  await prisma.contentItem.delete({ where: { id: String(formData.get("id") ?? "") } });
  revalidatePath("/marketing");
}

export async function createCampaign(formData: FormData) {
  await guard();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const starts = String(formData.get("startsAt") ?? "");
  const ends = String(formData.get("endsAt") ?? "");
  await prisma.campaign.create({
    data: {
      name,
      goal: String(formData.get("goal") ?? "").trim() || null,
      channel: String(formData.get("channel") ?? "").trim() || null,
      budget: Number(formData.get("budget")) || null,
      startsAt: starts ? new Date(starts) : null,
      endsAt: ends ? new Date(ends) : null,
      status: (String(formData.get("status") ?? "planned") as CampaignStatus) || "planned",
    },
  });
  revalidatePath("/marketing/campaigns");
}

export async function setCampaignStatus(formData: FormData) {
  await guard();
  await prisma.campaign.update({
    where: { id: String(formData.get("id") ?? "") },
    data: { status: String(formData.get("status") ?? "planned") as CampaignStatus },
  });
  revalidatePath("/marketing/campaigns");
}

export async function createUtmLink(formData: FormData) {
  await guard();
  const name = String(formData.get("name") ?? "").trim();
  const baseUrl = String(formData.get("baseUrl") ?? "").trim();
  if (!name || !baseUrl) return;
  await prisma.utmLink.create({
    data: {
      name,
      baseUrl,
      source: String(formData.get("source") ?? "").trim(),
      medium: String(formData.get("medium") ?? "").trim(),
      campaign: String(formData.get("campaign") ?? "").trim(),
      content: String(formData.get("content") ?? "").trim() || null,
      campaignId: String(formData.get("campaignId") ?? "") || null,
    },
  });
  revalidatePath("/marketing/utm");
}

export async function deleteUtmLink(formData: FormData) {
  await guard();
  await prisma.utmLink.delete({ where: { id: String(formData.get("id") ?? "") } });
  revalidatePath("/marketing/utm");
}
