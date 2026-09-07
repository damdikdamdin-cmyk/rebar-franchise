import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { isUk, canAccessTeam } from "@/lib/access";
import { getTemplate } from "@/lib/print/templates";
import { PrintFormEditor } from "@/components/print/form-editor";

export default async function PrintFormEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const canEdit = isUk(user.role) || user.role === "partner" || canAccessTeam(user.role);
  const template = await getTemplate(id);
  if (!template) notFound();
  if (!canEdit && !isUk(user.role) && user.role !== "seller" && user.role !== "partner") redirect("/");

  return (
    <div className="space-y-4">
      <Link href="/settings/print-forms" className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        ← Печатные формы
      </Link>
      <PrintFormEditor
        canEdit={canEdit}
        template={{
          id: template.id,
          key: template.key,
          name: template.name,
          scope: template.scope,
          html: template.html,
          pageWidthMm: template.pageWidthMm,
          pageHeightMm: template.pageHeightMm,
          marginMm: template.marginMm,
          fontSizePt: template.fontSizePt,
          isSystem: template.isSystem,
        }}
      />
    </div>
  );
}
