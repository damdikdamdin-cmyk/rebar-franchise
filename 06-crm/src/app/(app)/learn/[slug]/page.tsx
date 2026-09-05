import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Circle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { completeLesson, toggleChecklistItem } from "@/actions/learn";
import { Markdown } from "@/components/kb/markdown";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/fields";
import { cn } from "@/lib/utils";

export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lesson?: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;
  const sp = await searchParams;
  const course = await prisma.course.findUnique({
    where: { slug },
    include: { lessons: { orderBy: { sortOrder: "asc" }, include: { article: true } } },
  });
  if (!course) notFound();
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId: course.id } },
    include: { progress: true },
  });
  const progressByLesson = new Map(enrollment?.progress.map((p) => [p.lessonId, p]) ?? []);
  const firstOpen = course.lessons.find((l) => !progressByLesson.get(l.id)?.completedAt) ?? course.lessons[0];
  const current = course.lessons.find((l) => l.id === sp.lesson) ?? firstOpen;
  if (!current) notFound();
  const currentProgress = progressByLesson.get(current.id);
  const checked = new Set((currentProgress?.checked ?? "").split(",").filter(Boolean).map(Number));
  const checklist = current.checklist?.split("\n").filter(Boolean) ?? [];
  const done = course.lessons.filter((l) => progressByLesson.get(l.id)?.completedAt).length;
  const idx = course.lessons.findIndex((l) => l.id === current.id);
  const next = course.lessons[idx + 1];

  return (
    <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside>
        <Link href="/learn" className="eyebrow underline underline-offset-4">
          Обучение
        </Link>
        <h1 className="display mt-2 text-3xl">{course.title}</h1>
        <p className="mt-2 text-xs text-muted-foreground">{course.description}</p>
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-foreground" style={{ width: `${(done / Math.max(1, course.lessons.length)) * 100}%` }} />
        </div>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
          {done}/{course.lessons.length} уроков
        </p>
        <ol className="mt-6 space-y-1">
          {course.lessons.map((l, i) => {
            const isDone = !!progressByLesson.get(l.id)?.completedAt;
            const active = l.id === current.id;
            return (
              <li key={l.id}>
                <Link
                  href={`/learn/${course.slug}?lesson=${l.id}`}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent",
                    active && "bg-accent font-medium",
                  )}
                >
                  {isDone ? (
                    <Check className="size-4 shrink-0" />
                  ) : (
                    <Circle className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="font-mono text-[10px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                  <span className="truncate">{l.title}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </aside>

      <section className="min-w-0 max-w-3xl">
        <p className="eyebrow">
          Урок {idx + 1} из {course.lessons.length}
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h2 className="display text-4xl">{current.title}</h2>
          {currentProgress?.completedAt ? <Badge tone="success">Изучено</Badge> : null}
        </div>

        {current.article ? (
          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <p className="eyebrow">Материал: {current.article.title}</p>
              <Link href={`/kb/${current.article.slug}`} className="eyebrow underline underline-offset-4">
                Открыть в базе знаний
              </Link>
            </div>
            <Card className="max-h-[60vh] overflow-y-auto px-6 py-4">
              <Markdown body={current.article.body} />
            </Card>
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">У урока нет статьи — только чек-лист.</p>
        )}

        {checklist.length ? (
          <div className="mt-8">
            <p className="eyebrow mb-2">Чек-лист «изучил»</p>
            <Card className="divide-y divide-border">
              {checklist.map((item, i) => (
                <form key={i} action={toggleChecklistItem}>
                  <input type="hidden" name="lessonId" value={current.id} />
                  <input type="hidden" name="index" value={i} />
                  <button type="submit" className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-accent">
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-sm border border-border",
                        checked.has(i) && "bg-foreground text-background",
                      )}
                    >
                      {checked.has(i) ? <Check className="size-3.5" /> : null}
                    </span>
                    <span className={cn(checked.has(i) && "text-muted-foreground line-through")}>{item}</span>
                  </button>
                </form>
              ))}
            </Card>
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <form action={completeLesson}>
            <input type="hidden" name="lessonId" value={current.id} />
            {currentProgress?.completedAt ? <input type="hidden" name="undo" value="1" /> : null}
            <Button
              type="submit"
              variant={currentProgress?.completedAt ? "outline" : "default"}
              disabled={!currentProgress?.completedAt && checklist.length > 0 && checked.size < checklist.length}
            >
              {currentProgress?.completedAt ? "Снять отметку" : "Отметить «изучил»"}
            </Button>
          </form>
          {next ? (
            <Button asChild variant="ghost">
              <Link href={`/learn/${course.slug}?lesson=${next.id}`}>Следующий урок →</Link>
            </Button>
          ) : null}
          {checklist.length > 0 && checked.size < checklist.length && !currentProgress?.completedAt ? (
            <p className="text-xs text-muted-foreground">Отметьте все пункты чек-листа, чтобы закрыть урок.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
