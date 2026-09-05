import { loginAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/fields";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invited?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden w-[42%] flex-col justify-between bg-foreground px-10 py-10 text-background md:flex">
        <p className="font-serif text-3xl italic">re:bar</p>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-background/50">Закрытая сеть</p>
          <h1 className="mt-3 max-w-sm font-serif text-4xl italic leading-tight">Одна система на всю франшизу.</h1>
          <p className="mt-4 max-w-sm text-sm text-background/70">
            Воронка УК, запуск партнёра и розница точек — в одном контуре. Только по приглашению.
          </p>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-background/40">Hub · v1</p>
      </div>
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <form action={loginAction} className="w-full max-w-sm space-y-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Вход</p>
            <h2 className="mt-1 font-serif text-3xl italic">re:bar Hub</h2>
          </div>
          {params.error ? (
            <p className="border border-destructive/40 px-3 py-2 text-sm text-destructive">Неверный email или пароль.</p>
          ) : null}
          {params.invited ? (
            <p className="border border-border bg-card px-3 py-2 text-sm">Аккаунт создан. Войдите.</p>
          ) : null}
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="username" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Пароль</Label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          <Button type="submit" className="w-full">
            Войти
          </Button>
        </form>
      </div>
    </div>
  );
}
