"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { notifyUsers } from "@/lib/notify";
import { randomToken } from "@/lib/utils";

export async function onboardingProfile(formData: FormData) {
  const user = await requireUser();
  if (!user.partnerId) redirect("/");
  await prisma.user.update({
    where: { id: user.id },
    data: { name: String(formData.get("name") ?? "").trim() || undefined, phone: String(formData.get("phone") ?? "").trim() || null },
  });
  await prisma.partner.update({
    where: { id: user.partnerId },
    data: {
      company: String(formData.get("company") ?? "").trim() || null,
      telegramChat: String(formData.get("telegramChat") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || undefined,
    },
  });
  redirect("/onboarding?step=2");
}

export async function onboardingStore(formData: FormData) {
  const user = await requireUser();
  if (!user.partnerId) redirect("/");
  const storeId = String(formData.get("storeId") ?? "");
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (store && store.partnerId === user.partnerId) {
    await prisma.store.update({
      where: { id: storeId },
      data: {
        name: String(formData.get("name") ?? "").trim() || undefined,
        address: String(formData.get("address") ?? "").trim() || null,
        phone: String(formData.get("phone") ?? "").trim() || null,
      },
    });
  }
  redirect("/onboarding?step=3");
}

export async function onboardingInvites(formData: FormData) {
  const user = await requireUser();
  if (!user.partnerId) redirect("/");
  const emails = formData.getAll("email").map((e) => String(e).toLowerCase().trim()).filter(Boolean);
  const roles = formData.getAll("role").map((r) => String(r) as Role);
  const storeId = String(formData.get("storeId") ?? "") || null;
  for (let i = 0; i < emails.length; i++) {
    const role = roles[i] === "store_manager" ? "store_manager" : "seller";
    await prisma.invite.create({
      data: {
        email: emails[i],
        role,
        partnerId: user.partnerId,
        storeId,
        token: randomToken(24),
        expiresAt: new Date(Date.now() + 14 * 86400000),
        createdById: user.id,
      },
    });
  }
  redirect("/onboarding?step=4");
}

export async function onboardingFinish() {
  const user = await requireUser();
  if (!user.partnerId) redirect("/");
  await prisma.user.update({ where: { id: user.id }, data: { onboardedAt: new Date() } });
  const partner = await prisma.partner.findUnique({ where: { id: user.partnerId } });
  const watchers = await prisma.user.findMany({
    where: { OR: [{ role: { in: ["founder", "uk_admin"] } }, { id: partner?.curatorUserId ?? "__none__" }] },
    select: { id: true },
  });
  await notifyUsers(
    watchers.map((w) => w.id),
    `${user.name} завершил онбординг`,
    partner ? `${partner.city} · ${partner.name}` : undefined,
    partner ? `/partners/${partner.id}` : "/partners",
  );
  revalidatePath("/");
  redirect("/?welcome=1");
}
