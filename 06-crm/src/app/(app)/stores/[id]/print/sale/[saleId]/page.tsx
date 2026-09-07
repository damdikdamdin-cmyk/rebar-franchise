import { redirect } from "next/navigation";

/** Legacy URL → единый движок /print/[key]. */
export default async function LegacySalePrintRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; saleId: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id, saleId } = await params;
  const { type } = await searchParams;
  const key = type === "warranty" ? "warranty" : "receipt";
  redirect(`/print/${key}?sale=${saleId}&store=${id}`);
}
