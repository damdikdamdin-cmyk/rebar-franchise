import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Pencil } from "lucide-react";
import { requireUser } from "@/lib/session";
import { extractHeadings, getArticleForUser, visibleSpaces } from "@/lib/kb";
import { canEditKb, parseRoles, ROLE_LABEL } from "@/lib/access";
import { Markdown } from "@/components/kb/markdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/fields";
import { shortDate } from "@/lib/format";

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const article = await getArticleForUser(user, slug);
  if (!article) notFound();
  const space = (await visibleSpaces(user)).find((s) => s.id === article.spaceId);
  const headings = extractHeadings(article.body);
  const roles = parseRoles(article.visibleRoles ?? article.space.visibleRoles);

  return (
    <div className="grid gap-8 xl:grid-cols-[220px_minmax(0,1fr)_220px]">
      <aside className="hidden xl:block">
        <p className="eyebrow mb-2">
          <Link href={`/kb/space/${article.space.slug}`} className="underline underline-offset-4">
            {article.space.name}
          </Link>
        </p>
        <ul className="space-y-0.5 text-sm">
          {space?.articles.map((a) => (
            <li key={a.id}>
              <Link
                href={`/kb/${a.slug}`}
                className={`block truncate rounded-sm px-2 py-1 hover:bg-accent ${a.id === article.id ? "bg-accent font-medium" : "text-muted-foreground"}`}
              >
                {a.title}
              </Link>
            </li>
          ))}
        </ul>
      </aside>

      <article className="min-w-0 max-w-3xl">
        <p className="eyebrow xl:hidden">
          <Link href="/kb">База знаний</Link> / <Link href={`/kb/space/${article.space.slug}`}>{article.space.name}</Link>
        </p>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="display text-4xl sm:text-5xl">{article.title}</h1>
            {article.summary ? <p className="mt-3 text-sm text-muted-foreground">{article.summary}</p> : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {article.status !== "published" ? <Badge tone="warn">{article.status}</Badge> : null}
              <Badge tone="steel">v{article.version}</Badge>
              <span className="font-mono text-[10px] text-muted-foreground">
                обновлено {shortDate(article.updatedAt)}
                {article.author ? ` · ${article.author.name}` : ""}
              </span>
              {article.tags?.split(",").map((t) => (
                <Link key={t} href={`/kb?q=${encodeURIComponent(t.trim())}`}>
                  <Badge>{t.trim()}</Badge>
                </Link>
              ))}
            </div>
          </div>
          {canEditKb(user.role) ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/kb/${article.slug}/edit`}>
                <Pencil /> Редактировать
              </Link>
            </Button>
          ) : null}
        </div>

        {article.attachments.length ? (
          <div className="mb-6 flex flex-wrap gap-2">
            {article.attachments.map((f) => (
              <a
                key={f.id}
                href={f.path}
                download
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-accent"
              >
                <Download className="size-3.5" /> {f.name}
              </a>
            ))}
          </div>
        ) : null}

        <Markdown body={article.body} />

        {article.lessons.length ? (
          <div className="mt-10 rounded-lg border border-border bg-muted/40 px-5 py-4">
            <p className="eyebrow">Используется в обучении</p>
            <ul className="mt-2 space-y-1 text-sm">
              {article.lessons.map((l) => (
                <li key={l.id}>
                  <Link href={`/learn/${l.course.slug}`} className="underline underline-offset-4">
                    {l.course.title}
                  </Link>{" "}
                  <span className="text-muted-foreground">· {l.title}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </article>

      <aside className="hidden xl:block">
        {headings.length ? (
          <>
            <p className="eyebrow mb-2">Содержание</p>
            <ul className="space-y-1 text-xs">
              {headings.map((h) => (
                <li key={h.id + h.text} className={h.level === 3 ? "pl-3" : ""}>
                  <a href={`#${h.id}`} className="block truncate text-muted-foreground hover:text-foreground">
                    {h.text}
                  </a>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <p className="eyebrow mb-2 mt-8">Доступ</p>
        <p className="text-xs text-muted-foreground">{roles.length ? roles.map((r) => ROLE_LABEL[r]).join(", ") : "Все роли"}</p>
        {article.sourcePath ? (
          <>
            <p className="eyebrow mb-1 mt-6">Источник</p>
            <p className="break-all font-mono text-[10px] text-muted-foreground">{article.sourcePath}</p>
          </>
        ) : null}
      </aside>
    </div>
  );
}
