import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { canAccessTeam, isUk, STORE_ROLES } from "@/lib/access";
import { getTemplate } from "@/lib/print/templates";
import { PrintFormEditor } from "@/components/print/form-editor";

export default async function PrintFormEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const canView = isUk(user.role) || user.role === "partner" || STORE_ROLES.includes(user.role);
  const canEdit =
    isUk(user.role) || user.role === "partner" || user.role === "store_manager" || canAccessTeam(user.role);
  if (!canView) redirect("/");
  const template = await getTemplate(id);
  if (!template) notFound();

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

