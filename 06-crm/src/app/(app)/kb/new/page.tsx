import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { canEditKb } from "@/lib/access";
import { createArticle } from "@/actions/kb";
import { ArticleEditor } from "@/components/kb/article-editor";
import { PageHeader } from "@/components/ui/fields";

export default async function NewArticlePage({ searchParams }: { searchParams: Promise<{ space?: string; error?: string }> }) {
  const user = await requireUser();
  if (!canEditKb(user.role)) redirect("/kb");
  const sp = await searchParams;
  const spaces = await prisma.kbSpace.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });

  return (
    <div>
      <PageHeader eyebrow="База знаний" title="Новая статья" description={sp.error ? "Укажите раздел и заголовок." : undefined} />
      <ArticleEditor
        action={createArticle}
        spaces={spaces}
        initial={{ spaceId: sp.space, body: "## Зачем\n\n## Как делать\n\n## Критерий готовности\n" }}
        submitLabel="Опубликовать"
      />
    </div>
  );
}
