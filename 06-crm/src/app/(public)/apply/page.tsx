import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notifyTelegram } from "@/lib/telegram";
import { notifyRoles } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/fields";
import { redirect } from "next/navigation";

async function apply(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!name || !phone) redirect("/apply?error=1");
  const owner = await prisma.user.findFirst({ where: { role: "uk_sales" }, select: { id: true } });
  const lead = await prisma.lead.create({
    data: {
      name,
      phone,
      email: String(formData.get("email") ?? "").trim() || null,
      city: String(formData.get("city") ?? "").trim() || null,
      note: String(formData.get("note") ?? "").trim() || null,
      format: (String(formData.get("format") ?? "") as "flagship" | "standard" | "pickup") || null,
      source: "apply",
      ownerUserId: owner?.id ?? null,
    },
  });
  await prisma.leadActivity.create({ data: { leadId: lead.id, type: "note", body: "Заявка через форму /apply" } });
  await notifyRoles(["founder", "uk_admin", "uk_sales"], `Новая заявка: ${name}`, `${lead.city ?? "город?"} · ${phone}`, `/pipeline/${lead.id}`);
  await notifyTelegram(`Новая заявка re:bar (apply)\n${name}\n${phone}\n${lead.city || "город не указан"}`);
  redirect("/apply?sent=1");
}

export default async function ApplyPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const sp = await searchParams;
  if (sp.sent) {
    return (
      <div className="w-full max-w-sm">
        <p className="eyebrow">Заявка принята</p>
        <h2 className="display mt-1 text-4xl">Свяжемся в течение дня</h2>
        <p className="mt-4 text-sm text-muted-foreground">Менеджер УК позвонит, расскажет про форматы и пришлёт презентацию.</p>
        <Link href="/login" className="mt-6 inline-block text-xs underline underline-offset-4">
          Вход для партнёров
        </Link>
      </div>
    );
  }
  return (
    <div className="w-full max-w-sm">
      <p className="eyebrow">Франшиза re:bar</p>
      <h2 className="display mt-1 text-4xl">Заявка на партнёрство</h2>
      {sp.error ? <p className="mt-4 text-sm text-destructive">Имя и телефон обязательны.</p> : null}
      <form action={apply} className="mt-8 space-y-4">
        <Field label="Имя">
          <Input name="name" required />
        </Field>
        <Field label="Телефон">
          <Input name="phone" type="tel" required />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" />
        </Field>
        <Field label="Город">
          <Input name="city" />
        </Field>
        <Field label="Формат">
          <Select name="format" defaultValue="">
            <option value="">Пока не знаю</option>
            <option value="pickup">Пункт выдачи · до 20 м²</option>
            <option value="standard">Стандарт · 20–35 м²</option>
            <option value="flagship">Флагман · 35–50 м²</option>
          </Select>
        </Field>
        <Field label="Комментарий">
          <Textarea name="note" className="min-h-16" />
        </Field>
        <Button type="submit" className="w-full">
          Отправить
        </Button>
      </form>
    </div>
  );
}
