import Link from "next/link";
import { Compass, Megaphone, Phone, Rocket, Scale, Store, type LucideIcon } from "lucide-react";
import { requireUser } from "@/lib/session";
import { searchArticles, visibleSpaces } from "@/lib/kb";
import { canEditKb } from "@/lib/access";
import { Button } from "@/components/ui/button";
import { Card, Input, PageHeader } from "@/components/ui/fields";
import { shortDate } from "@/lib/format";

const ICONS: Record<string, LucideIcon> = { compass: Compass, scale: Scale, rocket: Rocket, phone: Phone, megaphone: Megaphone, store: Store };

export default async function KbPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q } = await searchParams;
  const spaces = await visibleSpaces(user);
  const results = q ? await searchArticles(user, q) : [];
  const total = spaces.reduce((n, s) => n + s.articles.length, 0);

  return (
    <div>
      <PageHeader
        eyebrow={`${spaces.length} направлений · ${total} статей`}
        title="База знаний"
        description="Единый источник правды для УК, кураторов, партнёров и точек. Видите только то, что относится к вашей роли."
        actions={
          canEditKb(user.role) ? (
            <Button asChild variant="outline">
              <Link href="/kb/new">Новая статья</Link>
            </Button>
          ) : null
        }
      />

      <form className="mb-8 flex max-w-xl gap-2">
        <Input name="q" defaultValue={q ?? ""} placeholder="Поиск по статьям: роялти, аренда, скрипт, UTM…" />
        <Button type="submit" variant="secondary">
          Найти
        </Button>
      </form>

      {q ? (
        <section className="mb-10">
          <p className="eyebrow mb-2">
            Результаты по «{q}» · {results.length}
          </p>
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ничего не найдено. Попробуйте другое слово.</p>
          ) : (
            <Card className="divide-y divide-border">
              {results.map((a) => (
                <Link key={a.id} href={`/kb/${a.slug}`} className="block px-4 py-3 hover:bg-accent">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{a.title}</p>
                    <span className="eyebrow shrink-0">{a.space.name}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{a.snippet}</p>
                </Link>
              ))}
            </Card>
          )}
        </section>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {spaces.map((s) => {
          const Icon = ICONS[s.icon ?? ""] ?? Compass;
          return (
            <Card key={s.id} className="flex flex-col">
              <div className="flex items-start gap-3 px-5 pt-5">
                <span className="flex size-9 items-center justify-center rounded-md bg-foreground text-background">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="display text-2xl">{s.name}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                </div>
              </div>
              <ul className="mt-4 flex-1 divide-y divide-border border-t border-border">
                {s.articles.slice(0, 6).map((a) => (
                  <li key={a.id}>
                    <Link href={`/kb/${a.slug}`} className="flex items-center justify-between gap-3 px-5 py-2 text-sm hover:bg-accent">
                      <span className="truncate">{a.title}</span>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{shortDate(a.updatedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="border-t border-border px-5 py-2">
                <Link href={`/kb/space/${s.slug}`} className="eyebrow underline underline-offset-4">
                  Все {s.articles.length} статей
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
