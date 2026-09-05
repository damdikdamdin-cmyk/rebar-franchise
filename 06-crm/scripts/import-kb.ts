/**
 * Импорт базы знаний из документов репозитория.
 * md/txt → как есть; docx → markdown через mammoth; pdf → текст через pdf-parse.
 * Оригиналы копируются в public/kb-files для скачивания.
 */
import { PrismaClient } from "@prisma/client";
import { promises as fs } from "node:fs";
import path from "node:path";
import { COURSES, MANIFEST, type ManifestDoc } from "./kb-manifest";

const prisma = new PrismaClient();
const REPO_ROOT = path.resolve(__dirname, "../..");
const FILES_DIR = path.resolve(__dirname, "../public/kb-files");

async function readMarkdown(doc: ManifestDoc): Promise<string> {
  const abs = path.join(REPO_ROOT, doc.path);
  const ext = path.extname(abs).toLowerCase();
  if (ext === ".md" || ext === ".txt") {
    const raw = await fs.readFile(abs, "utf8");
    return ext === ".txt" ? txtToMarkdown(raw) : raw;
  }
  if (ext === ".docx") {
    // convertToMarkdown есть в рантайме, но отсутствует в типах mammoth
    const mammoth = (await import("mammoth")) as unknown as {
      convertToMarkdown: (input: { buffer: Buffer }) => Promise<{ value: string }>;
    };
    const buf = await fs.readFile(abs);
    const result = await mammoth.convertToMarkdown({ buffer: buf });
    return cleanupMarkdown(result.value);
  }
  if (ext === ".pdf") {
    // прямой импорт lib: индекс pdf-parse запускает свой debug-тест при ESM-загрузке
    const mod = await import("pdf-parse/lib/pdf-parse.js");
    const pdfParse = (typeof mod === "function" ? mod : mod.default) as (b: Buffer) => Promise<{ text: string }>;
    const buf = await fs.readFile(abs);
    const data = await pdfParse(buf);
    return pdfTextToMarkdown(data.text);
  }
  throw new Error(`Unsupported format: ${doc.path}`);
}

function txtToMarkdown(raw: string) {
  const lines = raw.replace(/^\uFEFF/, "").split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trimEnd();
    if (/^_{5,}$/.test(t.trim())) {
      out.push("\n---\n");
    } else if (/^§\d{2}\s+·\s+/.test(t)) {
      out.push(`## ${t}`);
    } else if (/^\d{2}\.\s+[A-ZА-ЯЁ]/.test(t) && t.length < 120) {
      out.push(`### ${t}`);
    } else if (/^[А-ЯЁA-Z][А-ЯЁA-Z\s·\-—:0-9/]{6,}$/.test(t.trim()) && t.trim().length < 80) {
      out.push(`#### ${t.trim()}`);
    } else if (/^•\s/.test(t.trim())) {
      out.push(t.replace(/^\s*•\s/, "- "));
    } else {
      out.push(t);
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

function pdfTextToMarkdown(text: string) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^(\d+(\.\d+)*)\s+([А-ЯЁA-Z][^\n]{3,80})$/gm, "### $1 $3");
}

function cleanupMarkdown(md: string) {
  const BLANK = "\u0000";
  return (
    md
      // экранированные подчёркивания — это «пропуски для заполнения», сохраняем как есть
      .replace(/\\_/g, BLANK)
      // mammoth: __bold__ → **bold**
      .replace(/__([^_\n]+?)__/g, "**$1**")
      .replace(/\\([.\-*#])/g, "$1")
      // «**текст **» → «**текст** » (иначе markdown не закрывает bold)
      .replace(/\*\*([^*\n]+?)\s+\*\*/g, "**$1** ")
      .replace(/\*\*\s+([^*\n]+?)\*\*/g, " **$1**")
      .replace(new RegExp(BLANK, "g"), "_")
      .replace(/\n{3,}/g, "\n\n")
      // «**1**\n\n**ПРЕДМЕТ**» (нумерованные заголовки разделов договора) → «## 1. Предмет»
      .replace(/\*\*(\d{1,2})\*\*\n\n\*\*([^*\n]{3,80})\*\*/g, (_m, n: string, t: string) => `## ${n}. ${t.charAt(0) + t.slice(1).toLowerCase()}`)
      .trim()
  );
}

/** Разбивает стратегию по секциям «## §NN · …» на отдельные статьи */
function splitStrategy(md: string): Array<{ index: string; title: string; body: string }> {
  const parts = md.split(/\n(?=## §\d{2}\s+·)/);
  const sections: Array<{ index: string; title: string; body: string }> = [];
  for (const part of parts) {
    const m = part.match(/^## §(\d{2})\s+·\s+(.+)$/m);
    if (!m) continue;
    const index = m[1];
    const heading = m[2].trim();
    sections.push({ index, title: `§${index} · ${titleCase(heading)}`, body: part.trim() });
  }
  return sections;
}

function titleCase(s: string) {
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function firstParagraph(md: string) {
  const lines = md.split("\n").map((l) => l.trim());
  const p = lines.find((l) => l && !l.startsWith("#") && !l.startsWith("---") && !l.startsWith("|") && l.length > 40);
  return p ? p.replace(/[*_`>#]/g, "").slice(0, 200) : null;
}

async function main() {
  await fs.mkdir(FILES_DIR, { recursive: true });
  const spaces = await prisma.kbSpace.findMany();
  const spaceBySlug = new Map(spaces.map((s) => [s.slug, s]));
  const author = await prisma.user.findFirst({ where: { role: "founder" } });

  let created = 0;
  let failed = 0;

  for (const doc of MANIFEST) {
    const space = spaceBySlug.get(doc.space);
    if (!space) {
      console.warn(`skip ${doc.slug}: space ${doc.space} missing`);
      continue;
    }
    let md: string;
    try {
      md = await readMarkdown(doc);
    } catch (e) {
      failed++;
      console.warn(`FAILED ${doc.path}: ${(e as Error).message}`);
      continue;
    }

    const abs = path.join(REPO_ROOT, doc.path);
    const ext = path.extname(abs).toLowerCase();
    let attachment: { name: string; path: string; mime: string } | null = null;
    if (ext === ".docx" || ext === ".pdf") {
      const fileName = `${doc.slug}${ext}`;
      await fs.copyFile(abs, path.join(FILES_DIR, fileName));
      attachment = {
        name: path.basename(abs),
        path: `/kb-files/${fileName}`,
        mime: ext === ".pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      };
    }

    if (doc.splitSections) {
      const sections = splitStrategy(md);
      for (const [i, s] of sections.entries()) {
        await prisma.kbArticle.upsert({
          where: { slug: `${doc.slug}-${s.index}` },
          update: { title: s.title, body: s.body, summary: firstParagraph(s.body), sourcePath: doc.path, tags: doc.tags, sortOrder: i },
          create: {
            spaceId: space.id,
            slug: `${doc.slug}-${s.index}`,
            title: s.title,
            body: s.body,
            summary: firstParagraph(s.body),
            sourcePath: doc.path,
            tags: doc.tags ?? null,
            visibleRoles: doc.roles ?? null,
            sortOrder: i,
            authorId: author?.id,
          },
        });
        created++;
      }
      continue;
    }

    const article = await prisma.kbArticle.upsert({
      where: { slug: doc.slug },
      update: { title: doc.title, body: md, summary: doc.summary ?? firstParagraph(md), sourcePath: doc.path, tags: doc.tags, visibleRoles: doc.roles ?? null },
      create: {
        spaceId: space.id,
        slug: doc.slug,
        title: doc.title,
        body: md,
        summary: doc.summary ?? firstParagraph(md),
        sourcePath: doc.path,
        tags: doc.tags ?? null,
        visibleRoles: doc.roles ?? null,
        sortOrder: MANIFEST.indexOf(doc),
        authorId: author?.id,
      },
    });
    if (attachment) {
      await prisma.kbAttachment.deleteMany({ where: { articleId: article.id } });
      await prisma.kbAttachment.create({ data: { articleId: article.id, ...attachment } });
    }
    created++;
  }

  // Курсы
  const articles = await prisma.kbArticle.findMany({ select: { id: true, slug: true } });
  const bySlug = new Map(articles.map((a) => [a.slug, a.id]));
  for (const [ci, c] of COURSES.entries()) {
    const course = await prisma.course.upsert({
      where: { slug: c.slug },
      update: { title: c.title, description: c.description, autoRoles: c.autoRoles, sortOrder: ci },
      create: { slug: c.slug, title: c.title, description: c.description, autoRoles: c.autoRoles, sortOrder: ci },
    });
    await prisma.lesson.deleteMany({ where: { courseId: course.id } });
    for (const [li, l] of c.lessons.entries()) {
      await prisma.lesson.create({
        data: {
          courseId: course.id,
          title: l.title,
          articleId: l.articleSlug ? bySlug.get(l.articleSlug) ?? null : null,
          checklist: l.checklist?.join("\n") ?? null,
          sortOrder: li,
        },
      });
    }
  }

  // Автозапись всех пользователей на курсы по роли
  const users = await prisma.user.findMany({ select: { id: true, role: true } });
  const courses = await prisma.course.findMany();
  for (const u of users) {
    for (const c of courses) {
      if (!c.autoRoles.split(",").map((r) => r.trim()).includes(u.role)) continue;
      await prisma.enrollment.upsert({
        where: { userId_courseId: { userId: u.id, courseId: c.id } },
        update: {},
        create: { userId: u.id, courseId: c.id },
      });
    }
  }

  console.log(`KB import: ${created} articles, ${COURSES.length} courses, ${failed} failed`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
