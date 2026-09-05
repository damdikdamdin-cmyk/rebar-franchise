import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { roleCanSee, type SessionUser } from "@/lib/access";

export async function visibleSpaces(user: SessionUser) {
  const spaces = await prisma.kbSpace.findMany({
    orderBy: { sortOrder: "asc" },
    include: { articles: { where: { status: "published" }, select: { id: true, slug: true, title: true, visibleRoles: true, updatedAt: true, sortOrder: true }, orderBy: [{ sortOrder: "asc" }, { title: "asc" }] } },
  });
  return spaces
    .filter((s) => roleCanSee(user.role, s.visibleRoles))
    .map((s) => ({ ...s, articles: s.articles.filter((a) => roleCanSee(user.role, a.visibleRoles)) }));
}

export async function searchArticles(user: SessionUser, q: string, take = 30) {
  const where: Prisma.KbArticleWhereInput = {
    status: "published",
    OR: [{ title: { contains: q } }, { body: { contains: q } }, { tags: { contains: q } }, { summary: { contains: q } }],
  };
  const rows = await prisma.kbArticle.findMany({ where, include: { space: true }, take: take * 2, orderBy: { updatedAt: "desc" } });
  return rows
    .filter((a) => roleCanSee(user.role, a.space.visibleRoles) && roleCanSee(user.role, a.visibleRoles))
    .slice(0, take)
    .map((a) => ({ ...a, snippet: snippet(a.body, q) }));
}

export function snippet(body: string, q: string, len = 160) {
  const idx = body.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return body.replace(/[#*_`>|]/g, "").slice(0, len).trim() + "…";
  const start = Math.max(0, idx - len / 3);
  return (
    (start > 0 ? "…" : "") +
    body
      .slice(start, start + len)
      .replace(/[#*_`>|]/g, "")
      .replace(/\s+/g, " ")
      .trim() +
    "…"
  );
}

export async function getArticleForUser(user: SessionUser, slug: string) {
  const article = await prisma.kbArticle.findUnique({
    where: { slug },
    include: { space: true, attachments: true, author: { select: { name: true } }, lessons: { include: { course: true } } },
  });
  if (!article) return null;
  if (article.status !== "published" && !["founder", "uk_admin", "uk_sales", "uk_curator", "uk_marketer"].includes(user.role)) return null;
  if (!roleCanSee(user.role, article.space.visibleRoles) || !roleCanSee(user.role, article.visibleRoles)) return null;
  return article;
}

export function extractHeadings(md: string) {
  return md
    .split("\n")
    .filter((l) => /^#{2,3}\s/.test(l))
    .map((l) => {
      const level = l.startsWith("###") ? 3 : 2;
      const text = l.replace(/^#{2,3}\s+/, "").replace(/[*_`]/g, "").trim();
      return { level, text, id: headingId(text) };
    })
    .slice(0, 40);
}

export function headingId(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
