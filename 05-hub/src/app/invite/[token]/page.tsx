import { acceptInvite } from "@/actions/ops";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/fields";
import { ROLE_LABEL } from "@/lib/access";

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const invite = await prisma.invite.findUnique({ where: { token } });
  const invalid = !invite || invite.usedAt || invite.expiresAt < new Date();

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <p className="font-serif text-2xl italic">re:bar Hub</p>
      {invalid ? (
        <p className="mt-6 text-sm text-muted-foreground">Приглашение недействительно или уже использовано.</p>
      ) : (
        <form action={acceptInvite} className="mt-8 space-y-4">
          <input type="hidden" name="token" value={token} />
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {ROLE_LABEL[invite.role]} · {invite.email}
          </p>
          <h1 className="font-serif text-3xl italic">Принять приглашение</h1>
          {error ? <p className="text-sm text-destructive">Проверьте имя и пароль (от 6 символов).</p> : null}
          <div className="space-y-1">
            <Label htmlFor="name">Имя</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Пароль</Label>
            <Input id="password" name="password" type="password" minLength={6} required />
          </div>
          <Button type="submit" className="w-full">
            Создать доступ
          </Button>
        </form>
      )}
    </div>
  );
}
