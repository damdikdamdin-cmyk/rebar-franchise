import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { assertStoreAccess } from "@/lib/access";
import { getTemplate } from "@/lib/print/templates";
import { renderTemplate, sampleContext, type PrintContext } from "@/lib/print/render";
import { customerContext, freeContext, productContext, saleContext, stockDocContext } from "@/lib/print/context";
import { PrintToolbar } from "@/components/print/print-toolbar";

type Query = {
  store?: string;
  sale?: string;
  product?: string;
  serial?: string;
  doc?: string;
  customer?: string;
  line?: string;
  copies?: string;
  sample?: string;
  auto?: string;
  /** несколько товаров: product=a,b,c или products=a:2,b:1 (id:кол-во) */
  products?: string;
};

export default async function PrintPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<Query> }) {
  const { key } = await params;
  const q = await searchParams;
  const user = await requireUser();
  const template = await getTemplate(key);
  if (!template) notFound();

  const storeId = q.store ?? user.storeId ?? null;
  if (storeId) {
    const store = await prisma.store.findUnique({ where: { id: storeId }, select: { id: true, partnerId: true } });
    if (!store || !assertStoreAccess(user, store)) redirect("/");
  }

  const contexts: PrintContext[] = [];
  if (q.sample) {
    contexts.push(sampleContext(template.scope));
  } else if (template.scope === "sale" && q.sale) {
    const c = await saleContext(q.sale);
    if (c) contexts.push(c);
  } else if (template.scope === "product" && (q.product || q.products)) {
    const items = q.products
      ? q.products.split(",").map((p) => {
          const [id, n] = p.split(":");
          return { id, n: Math.max(1, Math.min(200, Number(n) || 1)) };
        })
      : (q.product ?? "").split(",").map((id) => ({ id, n: Math.max(1, Math.min(200, Number(q.copies) || 1)) }));
    for (const it of items) {
      const c = await productContext(it.id, storeId, q.serial ?? null);
      if (c) for (let i = 0; i < it.n; i++) contexts.push(c);
    }
  } else if (template.scope === "stock_doc" && q.doc) {
    const c = await stockDocContext(q.doc);
    if (c) contexts.push(c);
  } else if (template.scope === "customer" && q.customer) {
    const c = await customerContext(q.customer, storeId, q.line ?? null);
    if (c) contexts.push(c);
  } else {
    contexts.push(await freeContext(storeId));
  }
  if (!contexts.length) notFound();

  const pages = contexts.map((c) => renderTemplate(template.html, c));
  const isLabel = template.pageHeightMm <= 60;
  const back = storeId ? `/stores/${storeId}` : "/";

  return (
    <>
      <style>{`
          @page { size: ${template.pageWidthMm}mm ${template.pageHeightMm}mm; margin: ${template.marginMm}mm; }
          html, body { margin: 0; padding: 0; background: #e5e7eb !important; }
          .print-root { font-family: Arial, Helvetica, sans-serif; font-size: ${template.fontSizePt}pt; color: #000; letter-spacing: 0; }
          .sheet { width: ${template.pageWidthMm}mm; min-height: ${template.pageHeightMm}mm; box-sizing: border-box; padding: ${template.marginMm}mm; margin: 16px auto; background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,.15); page-break-after: always; break-after: page; overflow: hidden; }
          .sheet:last-child { page-break-after: auto; break-after: auto; }
          .sheet p { margin: 0 0 .35em; line-height: 1.3; }
          .sheet h1, .sheet h2, .sheet h3 { margin: 0 0 .5em; line-height: 1.2; font-family: Arial, Helvetica, sans-serif; }
          .sheet h2 { font-size: 1.5em; }
          .sheet table { width: 100%; border-collapse: collapse; margin: 0 0 .6em; table-layout: auto; }
          .sheet td, .sheet th { border: 1px solid #000; padding: 2px 4px; vertical-align: top; text-align: left; }
          .sheet th { font-weight: bold; }
          .sheet table.plain td, .sheet table.plain th { border: none; }
          .sheet svg { vertical-align: middle; max-width: 100%; }
          .sheet u { text-decoration: underline; }
          ${isLabel ? ".sheet { display:flex; flex-direction:column; justify-content:center; } .sheet td, .sheet th { border: none; padding: 0 2px; }" : ""}
          @media print {
            html, body { background: #fff !important; }
            .sheet { margin: 0; padding: 0; box-shadow: none; width: auto; min-height: 0; }
            .no-print { display: none !important; }
          }
        `}</style>
      <div className="print-root">
        <PrintToolbar title={template.name} back={back} editHref={`/settings/print-forms/${template.id}`} auto={q.auto === "1"} count={pages.length} />
        {pages.map((html, i) => (
          <div key={i} className="sheet" dangerouslySetInnerHTML={{ __html: html }} />
        ))}
      </div>
    </>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const t = await getTemplate(key);
  return { title: t ? `${t.name} — печать` : "Печать" };
}
