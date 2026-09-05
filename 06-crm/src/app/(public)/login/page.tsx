import Link from "next/link";
import { loginAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/fields";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invited?: string; reset?: string; callbackUrl?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="w-full max-w-sm">
      <p className="eyebrow">Вход</p>
      <h2 className="display mt-1 text-4xl">re:bar OS</h2>
      {sp.invited ? <p className="mt-4 text-sm">Аккаунт создан. Войдите с новым паролем.</p> : null}
      {sp.reset ? <p className="mt-4 text-sm">Пароль обновлён. Войдите.</p> : null}
      {sp.error ? <p className="mt-4 text-sm text-destructive">Неверный email или пароль.</p> : null}
      <form action={loginAction} className="mt-8 space-y-4">
        <input type="hidden" name="callbackUrl" value={sp.callbackUrl ?? "/"} />
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Пароль">
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>
        <Button type="submit" className="w-full">
          Войти
        </Button>
      </form>
      <p className="mt-6 text-xs text-muted-foreground">
        <Link href="/reset" className="underline underline-offset-4">
          Забыли пароль
        </Link>
        {" · "}
        <Link href="/apply" className="underline underline-offset-4">
          Стать партнёром
        </Link>
      </p>
    </div>
  );
}
