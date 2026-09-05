import { performPasswordReset } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/fields";

export default async function ResetPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  return (
    <div className="w-full max-w-sm">
      <p className="eyebrow">Восстановление</p>
      <h2 className="display mt-1 text-4xl">Новый пароль</h2>
      {sp.error ? <p className="mt-4 text-sm text-destructive">Пароль от 6 символов.</p> : null}
      <form action={performPasswordReset} className="mt-8 space-y-4">
        <input type="hidden" name="token" value={token} />
        <Field label="Пароль">
          <Input name="password" type="password" minLength={6} required autoComplete="new-password" />
        </Field>
        <Button type="submit" className="w-full">
          Сохранить
        </Button>
      </form>
    </div>
  );
}
