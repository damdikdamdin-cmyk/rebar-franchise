import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { visibleSpaces } from "@/lib/kb";
import { canEditKb } from "@/lib/access";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/fields";
import { shortDate } from "@/lib/format";

export default async function SpacePage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const space = (await visibleSpaces(user)).find((s) => s.slug === slug);
  if (!space) notFound();

  return (
    <div>
      <PageHeader
        eyebrow="База знаний · раздел"
        title={space.name}
        description={space.description ?? undefined}
        actions={
          canEditKb(user.role) ? (
            <Button asChild variant="outline">
              <Link href={`/kb/new?space=${space.id}`}>Статья в раздел</Link>
            </Button>
          ) : null
        }
      />
      <Card className="divide-y divide-border">
        {space.articles.map((a, i) => (
          <Link key={a.id} href={`/kb/${a.slug}`} className="flex items-center gap-4 px-5 py-3 hover:bg-accent">
            <span className="w-6 font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
            <span className="flex-1 text-sm">{a.title}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{shortDate(a.updatedAt)}</span>
          </Link>
        ))}
      </Card>
    </div>
  );
}
