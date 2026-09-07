import { rub } from "@/lib/format";

type SalePrint = {
  number: string | null;
  soldAt: Date;
  amount: number;
  discountTotal: number;
  creditAmount: number;
  store: { name: string; city: string; address: string | null; phone: string | null };
  customer: { name: string; phone: string } | null;
  seller: { name: string } | null;
  lines: Array<{
    name: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
    serial: string | null;
    product: { warrantyDays: number; code: string } | null;
  }>;
};

export function renderSaleReceipt(sale: SalePrint) {
  const lines = sale.lines
    .map(
      (l) =>
        `<tr><td>${escapeHtml(l.name)}${l.serial ? `<br/><small>S/N ${escapeHtml(l.serial)}</small>` : ""}</td><td>${l.qty}</td><td>${rub(l.unitPrice)}</td><td>${rub(l.lineTotal)}</td></tr>`,
    )
    .join("");
  return `
    <h1 style="font-family:serif;font-style:italic;font-size:28px;margin:0">re:bar</h1>
    <p style="font-family:monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.6">Товарный чек ${escapeHtml(sale.number ?? "")}</p>
    <p>${escapeHtml(sale.store.name)} · ${escapeHtml(sale.store.city)}${sale.store.phone ? ` · ${escapeHtml(sale.store.phone)}` : ""}</p>
    <p>Дата: ${sale.soldAt.toLocaleString("ru-RU")} · Продавец: ${escapeHtml(sale.seller?.name ?? "—")}</p>
    <p>Клиент: ${escapeHtml(sale.customer?.name ?? "Розничный покупатель")}${sale.customer ? ` · ${escapeHtml(sale.customer.phone)}` : ""}</p>
    <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px">
      <thead><tr><th align="left">Товар</th><th>Кол</th><th>Цена</th><th>Сумма</th></tr></thead>
      <tbody>${lines}</tbody>
    </table>
    <p style="margin-top:16px;font-family:monospace;font-size:16px">Итого: ${rub(sale.amount)}</p>
    ${sale.discountTotal ? `<p>Скидка: ${rub(sale.discountTotal)}</p>` : ""}
    ${sale.creditAmount ? `<p>Lendo: ${rub(sale.creditAmount)}</p>` : ""}
  `;
}

export function renderWarranty(sale: SalePrint) {
  const lines = sale.lines
    .map((l) => {
      const days = l.product?.warrantyDays ?? 365;
      const until = new Date(sale.soldAt);
      until.setDate(until.getDate() + days);
      return `<tr><td>${escapeHtml(l.product?.code ?? "—")}</td><td>${escapeHtml(l.name)}</td><td>${l.serial ? escapeHtml(l.serial) : "—"}</td><td>${until.toLocaleDateString("ru-RU")}</td><td>${l.qty}</td><td>${rub(l.lineTotal)}</td></tr>`;
    })
    .join("");
  return `
    <h1 style="font-family:serif;font-style:italic;font-size:28px;margin:0">Гарантийный талон</h1>
    <p style="font-family:monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.6">Документ ${escapeHtml(sale.number ?? "")} · ${sale.soldAt.toLocaleDateString("ru-RU")}</p>
    <p><b>${escapeHtml(sale.store.name)}</b><br/>${escapeHtml(sale.store.address ?? sale.store.city)}${sale.store.phone ? `<br/>${escapeHtml(sale.store.phone)}` : ""}</p>
    <p>Покупатель: ${escapeHtml(sale.customer?.name ?? "—")}</p>
    <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:13px">
      <thead><tr><th align="left">Код</th><th align="left">Наименование</th><th>S/N</th><th>Гарант. до</th><th>Кол</th><th>Цена</th></tr></thead>
      <tbody>${lines}</tbody>
    </table>
    <p style="margin-top:20px;font-size:12px;line-height:1.5">Условия гарантийного обслуживания: гарантия распространяется на производственные дефекты при сохранении товарного вида и комплектности. Гарантия не покрывает механические повреждения, следы жидкости и самостоятельный ремонт.</p>
    <p style="margin-top:24px">Подпись продавца ____________ / ${escapeHtml(sale.seller?.name ?? "")}</p>
  `;
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
