import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { canEditKb } from "@/lib/access";
import { archiveArticle, updateArticle } from "@/actions/kb";
import { ArticleEditor } from "@/components/kb/article-editor";
import { PageHeader } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";

export default async function EditArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  if (!canEditKb(user.role)) redirect("/kb");
  const { slug } = await params;
  const [article, spaces] = await Promise.all([
    prisma.kbArticle.findUnique({ where: { slug } }),
    prisma.kbSpace.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!article) notFound();

  return (
    <div>
      <PageHeader
        eyebrow={`Редактирование · v${article.version}`}
        title={article.title}
        actions={
          <form action={archiveArticle}>
            <input type="hidden" name="id" value={article.id} />
            <Button type="submit" variant="ghost" size="sm">
              В архив
            </Button>
          </form>
        }
      />
      <ArticleEditor action={updateArticle} spaces={spaces} initial={article} submitLabel="Сохранить версию" />
    </div>
  );
}
