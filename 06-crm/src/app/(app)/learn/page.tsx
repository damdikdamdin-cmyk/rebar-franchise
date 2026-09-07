import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isUk, parseRoles, ROLE_LABEL } from "@/lib/access";
import { courseProgress } from "@/lib/learning";
import { enroll } from "@/actions/learn";
import { Button } from "@/components/ui/button";
import { Badge, Card, PageHeader } from "@/components/ui/fields";

export default async function LearnPage() {
  const user = await requireUser();
  const [courses, enrollments] = await Promise.all([
    prisma.course.findMany({ orderBy: { sortOrder: "asc" }, include: { lessons: true } }),
    prisma.enrollment.findMany({ where: { userId: user.id }, include: { progress: true, course: { include: { lessons: true } } } }),
  ]);
  const byCourse = new Map(enrollments.map((e) => [e.courseId, e]));
  const mine = courses.filter((c) => byCourse.has(c.id));
  const others = courses.filter((c) => !byCourse.has(c.id));

  return (
    <div>
      <PageHeader
        eyebrow="Обучение"
        title="Курсы"
        description="Курсы назначаются автоматически по роли. Каждый урок — статья базы знаний и чек-лист «изучил»."
        actions={
          isUk(user.role) || user.role === "partner" ? (
            <Button asChild variant="outline">
              <Link href="/learn/progress">Прогресс команды</Link>
            </Button>
          ) : null
        }
      />

      <section className="mb-10">
        <p className="eyebrow mb-3">Мои курсы</p>
        {mine.length === 0 ? (
          <p className="text-sm text-muted-foreground">Пока нет назначенных курсов.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {mine.map((c) => {
              const e = byCourse.get(c.id)!;
              const p = courseProgress(e);
              return (
                <Link key={c.id} href={`/learn/${c.slug}`} className="group">
                  <Card className="flex h-full flex-col px-5 py-5 transition-colors group-hover:bg-accent">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="display text-2xl">{c.title}</h2>
                      {e.completedAt ? <Badge tone="success">Завершён</Badge> : <Badge tone="steel">{p.pct}%</Badge>}
                    </div>
                    <p className="mt-2 flex-1 text-xs text-muted-foreground">{c.description}</p>
                    <div className="mt-4 h-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-foreground transition-all" style={{ width: `${p.pct}%` }} />
                    </div>
                    <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                      {p.done}/{p.total} уроков
                    </p>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {others.length ? (
        <section>
          <p className="eyebrow mb-3">Другие курсы</p>
          <Card className="divide-y divide-border">
            {others.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{c.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.lessons.length} уроков · для: {parseRoles(c.autoRoles).map((r) => ROLE_LABEL[r]).join(", ")}
                  </p>
                </div>
                <form action={enroll}>
                  <input type="hidden" name="courseId" value={c.id} />
                  <Button type="submit" size="sm" variant="outline">
                    Записаться
                  </Button>
                </form>
              </div>
            ))}
          </Card>
        </section>
      ) : null}
    </div>
  );
}
