import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { notifyTelegram } from "@/lib/telegram";
import { notifyRoles } from "@/lib/notify";

const leadSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().min(5).max(40),
  email: z.string().email().max(120).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  note: z.string().max(2000).optional().nullable(),
  source: z.string().max(80).optional(),
  utmSource: z.string().max(80).optional().nullable(),
  utmMedium: z.string().max(80).optional().nullable(),
  utmCampaign: z.string().max(80).optional().nullable(),
});

function cors(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, X-Api-Key");
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  return res;
}

export function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

export async function POST(request: Request) {
  const secret = process.env.LEADS_WEBHOOK_SECRET;
  const key = request.headers.get("x-api-key") ?? new URL(request.url).searchParams.get("key");
  if (!secret || key !== secret) return cors(NextResponse.json({ error: "unauthorized" }, { status: 401 }));

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return cors(NextResponse.json({ error: "invalid json" }, { status: 400 }));
  }
  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) return cors(NextResponse.json({ error: "invalid payload" }, { status: 400 }));

  const d = parsed.data;
  const owner = await prisma.user.findFirst({ where: { role: "uk_sales" }, select: { id: true } });
  const lead = await prisma.lead.create({
    data: {
      name: d.name.trim(),
      phone: d.phone.trim(),
      email: d.email?.trim() || null,
      city: d.city?.trim() || null,
      note: d.note?.trim() || null,
      source: d.source?.trim() || "landing",
      utmSource: d.utmSource || null,
      utmMedium: d.utmMedium || null,
      utmCampaign: d.utmCampaign || null,
      stage: "new",
      ownerUserId: owner?.id ?? null,
    },
  });
  await prisma.leadActivity.create({ data: { leadId: lead.id, type: "note", body: `Заявка: ${lead.source}` } });
  await notifyRoles(["founder", "uk_admin", "uk_sales"], `Новая заявка: ${lead.name}`, `${lead.city ?? "город?"} · ${lead.phone}`, `/pipeline/${lead.id}`);
  await notifyTelegram(`Новая заявка re:bar\n${lead.name}\n${lead.phone}\n${lead.city || "город не указан"}\n${lead.note || ""}`);

  return cors(NextResponse.json({ ok: true, id: lead.id }));
}
