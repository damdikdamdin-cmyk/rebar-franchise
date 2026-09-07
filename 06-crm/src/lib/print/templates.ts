import { prisma } from "@/lib/prisma";
import { SYSTEM_TEMPLATES } from "./defaults";
import type { PrintScope } from "./variables";

/** Гарантирует, что системные шаблоны есть в базе (не перетирая правки пользователей). */
export async function ensurePrintTemplates() {
  const existing = new Set((await prisma.printTemplate.findMany({ select: { key: true } })).map((t) => t.key));
  const missing = SYSTEM_TEMPLATES.filter((t) => !existing.has(t.key));
  for (const t of missing) {
    // page и generateMetadata могут сидировать параллельно — upsert без update терпим к гонке
    await prisma.printTemplate.upsert({
      where: { key: t.key },
      update: {},
      create: {
        key: t.key,
        name: t.name,
        scope: t.scope,
        html: t.html.trim(),
        pageWidthMm: t.pageWidthMm,
        pageHeightMm: t.pageHeightMm,
        marginMm: t.marginMm,
        fontSizePt: t.fontSizePt,
        sortOrder: t.sortOrder,
        isSystem: true,
        sourceFile: t.sourceFile ?? null,
      },
    });
  }
  return missing.length;
}

/** Системный HTML шаблона по ключу — для кнопки «По умолчанию». */
export function systemDefault(key: string) {
  return SYSTEM_TEMPLATES.find((t) => t.key === key) ?? null;
}

export async function listTemplates(scope?: PrintScope) {
  await ensurePrintTemplates();
  return prisma.printTemplate.findMany({
    where: { active: true, ...(scope ? { scope } : {}) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, key: true, name: true, scope: true, pageWidthMm: true, pageHeightMm: true, isSystem: true, updatedAt: true },
  });
}

export async function getTemplate(keyOrId: string) {
  await ensurePrintTemplates();
  return prisma.printTemplate.findFirst({ where: { OR: [{ key: keyOrId }, { id: keyOrId }] } });
}
