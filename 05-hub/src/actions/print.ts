"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { canAccessTeam, isUk } from "@/lib/access";
import { systemDefault } from "@/lib/print/templates";

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

async function requireEditor() {
  const user = await requireUser();
  if (!isUk(user.role) && user.role !== "partner" && user.role !== "seller") redirect("/");
  // УК и партнёры правят формы; продавцы — только печать
  const canEdit = isUk(user.role) || user.role === "partner" || canAccessTeam(user.role);
  return { user, canEdit };
}

export async function savePrintTemplate(formData: FormData) {
  const { user, canEdit } = await requireEditor();
  if (!canEdit) return;
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const html = String(formData.get("html") ?? "");
  const pageWidthMm = Number(formData.get("pageWidthMm") ?? 210);
  const pageHeightMm = Number(formData.get("pageHeightMm") ?? 297);
  const marginMm = Number(formData.get("marginMm") ?? 10);
  const fontSizePt = Number(formData.get("fontSizePt") ?? 11);
  if (!id || !name || !html) return;

  await prisma.printTemplate.update({
    where: { id },
    data: {
      name,
      html,
      pageWidthMm,
      pageHeightMm,
      marginMm,
      fontSizePt,
      updatedById: user.id,
    },
  });
  revalidatePath("/settings/print-forms");
  revalidatePath(`/settings/print-forms/${id}`);
  revalidatePath("/print");
}

export async function resetPrintTemplate(formData: FormData) {
  const { user, canEdit } = await requireEditor();
  if (!canEdit) return;
  const id = String(formData.get("id") ?? "");
  const tpl = await prisma.printTemplate.findUnique({ where: { id } });
  if (!tpl) return;
  const def = systemDefault(tpl.key);
  if (!def) return;
  await prisma.printTemplate.update({
    where: { id },
    data: {
      html: def.html.trim(),
      name: def.name,
      pageWidthMm: def.pageWidthMm,
      pageHeightMm: def.pageHeightMm,
      marginMm: def.marginMm,
      fontSizePt: def.fontSizePt,
      updatedById: user.id,
    },
  });
  revalidatePath(`/settings/print-forms/${id}`);
  revalidatePath("/print");
}

export async function createPrintTemplate(formData: FormData) {
  const { user, canEdit } = await requireEditor();
  if (!canEdit) return;
  const name = String(formData.get("name") ?? "").trim() || "Новая форма";
  const scope = String(formData.get("scope") ?? "free");
  const base = String(formData.get("fromKey") ?? "");
  const from = base ? systemDefault(base) ?? (await prisma.printTemplate.findFirst({ where: { key: base } })) : null;
  const key = `${slugify(name) || "form"}-${Date.now().toString(36).slice(-4)}`;
  const created = await prisma.printTemplate.create({
    data: {
      key,
      name,
      scope,
      html: from?.html ?? "<p>Новая печатная форма</p>",
      pageWidthMm: from?.pageWidthMm ?? 210,
      pageHeightMm: from?.pageHeightMm ?? 297,
      marginMm: from?.marginMm ?? 10,
      fontSizePt: from?.fontSizePt ?? 11,
      sortOrder: 900,
      isSystem: false,
      updatedById: user.id,
    },
  });
  revalidatePath("/settings/print-forms");
  redirect(`/settings/print-forms/${created.id}`);
}

export async function deactivatePrintTemplate(formData: FormData) {
  const { canEdit } = await requireEditor();
  if (!canEdit) return;
  const id = String(formData.get("id") ?? "");
  const tpl = await prisma.printTemplate.findUnique({ where: { id } });
  if (!tpl || tpl.isSystem) return;
  await prisma.printTemplate.update({ where: { id }, data: { active: false } });
  revalidatePath("/settings/print-forms");
  redirect("/settings/print-forms");
}
