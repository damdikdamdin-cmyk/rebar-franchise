import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { acceptInvite } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/fields";
import { ROLE_LABEL } from "@/lib/access";

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const invite =
    token === "expired"
      ? null
      : await prisma.invite.findUnique({ where: { token }, include: { partner: true, store: true } });
  const valid = invite && !invite.usedAt && invite.expiresAt > new Date();

  if (!valid) {
    return (
      <div className="w-full max-w-sm">
        <p className="eyebrow">Приглашение</p>
        <h2 className="display mt-1 text-4xl">Ссылка недействительна</h2>
        <p className="mt-4 text-sm text-muted-foreground">
          Приглашение истекло или уже использовано. Запросите новую ссылку у УК.
        </p>
        <Link href="/login" className="mt-6 inline-block text-sm underline underline-offset-4">
          На страницу входа
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <p className="eyebrow">Приглашение · {ROLE_LABEL[invite.role]}</p>
      <h2 className="display mt-1 text-4xl">Добро пожаловать в re:bar</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        {invite.partner ? `${invite.partner.city} · ${invite.partner.name}` : null}
        {invite.store ? ` · ${invite.store.name}` : null}
        {!invite.partner && !invite.store ? "Команда управляющей компании" : null}
      </p>
      {sp.error ? <p className="mt-4 text-sm text-destructive">Заполните имя и пароль от 6 символов.</p> : null}
      <form action={acceptInvite} className="mt-8 space-y-4">
        <input type="hidden" name="token" value={token} />
        <Field label="Email">
          <Input value={invite.email} disabled />
        </Field>
        <Field label="Имя и фамилия">
          <Input name="name" required autoComplete="name" defaultValue={invite.nameHint ?? ""} />
        </Field>
        <Field label="Телефон">
          <Input name="phone" type="tel" autoComplete="tel" />
        </Field>
        <Field label="Пароль" hint="Не менее 6 символов">
          <Input name="password" type="password" minLength={6} required autoComplete="new-password" />
        </Field>
        <Button type="submit" className="w-full">
          Создать аккаунт
        </Button>
      </form>
    </div>
  );
}
