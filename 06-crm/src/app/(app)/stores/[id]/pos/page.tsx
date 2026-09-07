import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PosCheckout } from "@/components/pos-checkout";

export default async function PosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sold?: string; print?: string }>;
}) {
  const { id } = await params;
  const { sold, print } = await searchParams;
  const [products, serials, imeiLogs] = await Promise.all([
    prisma.product.findMany({
      where: { active: true, deletedAt: null },
      include: { balances: true },
      orderBy: { name: "asc" },
    }),
    prisma.productSerial.findMany({
      where: { storeId: id, status: "in_stock" },
      select: { id: true, productId: true, serial: true },
      orderBy: { createdAt: "desc" },
      take: 5000,
    }),
    prisma.changeLog.findMany({
      where: {
        storeId: id,
        action: "imei_change",
        serialId: { not: null },
        serialOld: { not: null },
      },
      select: { serialId: true, serialOld: true, serialNew: true },
      orderBy: { createdAt: "desc" },
      take: 5000,
    }),
  ]);

  const serialById = new Map(serials.map((s) => [s.id, s]));
  const imeiAliases = imeiLogs
    .filter((l) => l.serialId && l.serialOld && serialById.has(l.serialId))
    .map((l) => {
      const current = serialById.get(l.serialId!)!;
      return {
        oldSerial: l.serialOld!,
        serialId: current.id,
        productId: current.productId,
        currentSerial: current.serial,
      };
    });

  const rows = products.map((p) => {
    const here = p.balances.find((b) => b.storeId === id)?.qty ?? 0;
    const other = p.balances.filter((b) => b.storeId !== id).reduce((s, b) => s + b.qty, 0);
    return {
      id: p.id,
      code: p.code,
      barcode: p.barcode,
      name: p.name,
      retailPrice: p.retailPrice,
      serialTracked: p.serialTracked,
      qty: here,
      otherQty: other,
    };
  });

  const printKeys = (print ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k === "receipt" || k === "warranty");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <span className="bg-foreground px-3 py-1.5 font-mono text-[10px] uppercase text-background">Касса</span>
        <Link
          href={`/stores/${id}/sales`}
          className="border border-border px-3 py-1.5 font-mono text-[10px] uppercase text-muted-foreground"
        >
          История чеков
        </Link>
      </div>
      <PosCheckout
        storeId={id}
        products={rows}
        serials={serials}
        imeiAliases={imeiAliases}
        soldId={sold}
        printKeys={printKeys}
      />
    </div>
  );
}
