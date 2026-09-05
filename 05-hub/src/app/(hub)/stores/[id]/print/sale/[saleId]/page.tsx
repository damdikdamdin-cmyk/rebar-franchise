import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "@/components/print-button";
import { renderSaleReceipt, renderWarranty } from "@/lib/print-templates";

export default async function PrintSalePage({
  params,
}: {
  params: Promise<{ id: string; saleId: string }>;
}) {
  const { id, saleId } = await params;
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      store: true,
      customer: true,
      seller: true,
      lines: { include: { product: true } },
    },
  });
  if (!sale || sale.storeId !== id) notFound();

  const receipt = renderSaleReceipt(sale);
  const warranty = renderWarranty(sale);

  return (
    <div className="mx-auto max-w-3xl space-y-8 print:max-w-none">
      <div className="flex flex-wrap gap-2 print:hidden">
        <a href="#receipt" className="border border-border px-3 py-2 text-sm">
          Чек
        </a>
        <a href="#warranty" className="border border-border px-3 py-2 text-sm">
          Гарантия
        </a>
        <PrintButton />
      </div>
      <article id="receipt" className="border border-border bg-card p-6" dangerouslySetInnerHTML={{ __html: receipt }} />
      <article id="warranty" className="border border-border bg-card p-6" dangerouslySetInnerHTML={{ __html: warranty }} />
    </div>
  );
}
