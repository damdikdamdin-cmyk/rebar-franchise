import Link from "next/link";
import { requestPasswordReset } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/fields";

export default async function ResetRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; expired?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="w-full max-w-sm">
      <p className="eyebrow">Восстановление</p>
      <h2 className="display mt-1 text-4xl">Сброс пароля</h2>
      {sp.sent ? (
        <p className="mt-4 text-sm">
          Запрос отправлен администратору УК. Он передаст вам ссылку для смены пароля.
        </p>
      ) : (
        <>
          {sp.expired ? <p className="mt-4 text-sm text-destructive">Ссылка устарела. Запросите новую.</p> : null}
          <form action={requestPasswordReset} className="mt-8 space-y-4">
            <Field label="Email">
              <Input name="email" type="email" required />
            </Field>
            <Button type="submit" className="w-full">
              Запросить ссылку
            </Button>
          </form>
        </>
      )}
      <Link href="/login" className="mt-6 inline-block text-xs underline underline-offset-4">
        Назад ко входу
      </Link>
    </div>
  );
}
