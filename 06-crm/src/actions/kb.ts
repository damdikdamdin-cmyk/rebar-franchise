"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ArticleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { canEditKb } from "@/lib/access";
import { slugify } from "@/lib/utils";

function rolesCsv(formData: FormData) {
  const roles = formData.getAll("roles").map(String).filter(Boolean);
  return roles.length ? roles.join(",") : null;
}

export async function createArticle(formData: FormData) {
  const user = await requireUser();
  if (!canEditKb(user.role)) redirect("/kb");
  const spaceId = String(formData.get("spaceId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  if (!spaceId || !title) redirect("/kb/new?error=1");

  let slug = slugify(title) || `article-${Date.now()}`;
  const exists = await prisma.kbArticle.findUnique({ where: { slug } });
  if (exists) slug = `${slug}-${Date.now().toString(36)}`;

  await prisma.kbArticle.create({
    data: {
      spaceId,
      slug,
      title,
      body,
      summary: String(formData.get("summary") ?? "").trim() || null,
      tags: String(formData.get("tags") ?? "").trim() || null,
      status: (String(formData.get("status") ?? "published") as ArticleStatus) ?? "published",
      visibleRoles: rolesCsv(formData),
      authorId: user.id,
    },
  });
  revalidatePath("/kb");
  redirect(`/kb/${slug}`);
}

export async function updateArticle(formData: FormData) {
  const user = await requireUser();
  if (!canEditKb(user.role)) redirect("/kb");
  const id = String(formData.get("id") ?? "");
  const article = await prisma.kbArticle.findUnique({ where: { id } });
  if (!article) redirect("/kb");

  const title = String(formData.get("title") ?? "").trim() || article.title;
  await prisma.kbArticle.update({
    where: { id },
    data: {
      title,
      body: String(formData.get("body") ?? article.body),
      summary: String(formData.get("summary") ?? "").trim() || null,
      tags: String(formData.get("tags") ?? "").trim() || null,
      status: String(formData.get("status") ?? article.status) as ArticleStatus,
      spaceId: String(formData.get("spaceId") ?? article.spaceId),
      visibleRoles: rolesCsv(formData),
      version: { increment: 1 },
      authorId: user.id,
    },
  });
  revalidatePath("/kb");
  revalidatePath(`/kb/${article.slug}`);
  redirect(`/kb/${article.slug}`);
}

export async function archiveArticle(formData: FormData) {
  const user = await requireUser();
  if (!canEditKb(user.role)) redirect("/kb");
  const id = String(formData.get("id") ?? "");
  await prisma.kbArticle.update({ where: { id }, data: { status: "archived" } });
  revalidatePath("/kb");
  redirect("/kb");
}
