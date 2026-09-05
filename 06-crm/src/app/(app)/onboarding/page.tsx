import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { onboardingFinish, onboardingInvites, onboardingProfile, onboardingStore } from "@/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Card, Field, Input, Select } from "@/components/ui/fields";
import { CopyButton } from "@/components/copy-button";
import { FORMAT_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";

const STEPS = ["Профиль", "Точка", "Команда", "Старт"];

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const user = await requireUser();
  if (user.role !== "partner" || !user.partnerId) redirect("/");
  const step = Math.min(4, Math.max(1, Number((await searchParams).step ?? 1)));
  const [me, partner, invites, course] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id } }),
    prisma.partner.findUnique({ where: { id: user.partnerId }, include: { stores: true, curator: true, launchProjects: { include: { tasks: true } } } }),
    prisma.invite.findMany({ where: { partnerId: user.partnerId, createdById: user.id, usedAt: null }, orderBy: { createdAt: "desc" } }),
    prisma.course.findUnique({ where: { slug: "partner-launch" }, include: { lessons: true } }),
  ]);
  if (!partner || !me) redirect("/");
  const store = partner.stores[0];
  const appUrl = process.env.APP_URL ?? "http://localhost:3100";
  const project = partner.launchProjects[0];

  return (
    <div className="mx-auto max-w-2xl">
      <p className="eyebrow">Онбординг партнёра · шаг {step} из 4</p>
      <h1 className="display mt-1 text-5xl">Добро пожаловать в сеть, {me.name.split(" ")[0]}.</h1>
      <ol className="mt-6 flex gap-2">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={cn(
              "flex-1 border-t-2 pt-2 font-mono text-[10px] uppercase tracking-[0.12em]",
              i + 1 <= step ? "border-foreground" : "border-border text-muted-foreground",
            )}
          >
            {s}
          </li>
        ))}
      </ol>

      <Card className="mt-8 px-6 py-6">
        {step === 1 ? (
          <form action={onboardingProfile} className="space-y-4">
            <div>
              <h2 className="display text-3xl">Кто вы</h2>
              <p className="mt-1 text-sm text-muted-foreground">Эти данные видит куратор и УК. Договор: {partner.city}, {FORMAT_LABEL[partner.format]}.</p>
            </div>
            <Field label="Имя и фамилия">
              <Input name="name" defaultValue={me.name} required />
            </Field>
            <Field label="Телефон">
              <Input name="phone" defaultValue={me.phone ?? partner.phone ?? ""} />
            </Field>
            <Field label="ИП / юрлицо" hint="Как в договоре">
              <Input name="company" defaultValue={partner.company ?? ""} placeholder="ИП Иванов И.И." />
            </Field>
            <Field label="Telegram chat id" hint="Необязательно: уведомления о шагах запуска в Telegram">
              <Input name="telegramChat" defaultValue={partner.telegramChat ?? ""} />
            </Field>
            <Button type="submit" className="w-full">
              Дальше
            </Button>
          </form>
        ) : null}

        {step === 2 && store ? (
          <form action={onboardingStore} className="space-y-4">
            <input type="hidden" name="storeId" value={store.id} />
            <div>
              <h2 className="display text-3xl">Ваша точка</h2>
              <p className="mt-1 text-sm text-muted-foreground">Адрес можно указать позже, когда согласуете помещение с куратором.</p>
            </div>
            <Field label="Название">
              <Input name="name" defaultValue={store.name} />
            </Field>
            <Field label="Адрес (если уже есть)">
              <Input name="address" defaultValue={store.address ?? ""} />
            </Field>
            <Field label="Телефон точки">
              <Input name="phone" defaultValue={store.phone ?? ""} />
            </Field>
            <div className="flex gap-2">
              <Button asChild variant="ghost">
                <Link href="/onboarding?step=1">Назад</Link>
              </Button>
              <Button type="submit" className="flex-1">
                Дальше
              </Button>
            </div>
          </form>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div>
              <h2 className="display text-3xl">Ваша команда</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Пригласите управляющего и продавцов — они получат курс «Рабочий день продавца» и стандарты. Можно пропустить и сделать позже в разделе «Команда».
              </p>
            </div>
            <form action={onboardingInvites} className="space-y-2">
              <input type="hidden" name="storeId" value={store?.id ?? ""} />
              {[0, 1, 2].map((i) => (
                <div key={i} className="grid grid-cols-[1fr_160px] gap-2">
                  <Input name="email" type="email" placeholder={`email сотрудника ${i + 1}`} />
                  <Select name="role" defaultValue={i === 0 ? "store_manager" : "seller"}>
                    <option value="store_manager">Управляющий</option>
                    <option value="seller">Продавец</option>
                  </Select>
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <Button asChild variant="ghost">
                  <Link href="/onboarding?step=2">Назад</Link>
                </Button>
                <Button type="submit" className="flex-1">
                  Создать приглашения
                </Button>
                <Button asChild variant="outline">
                  <Link href="/onboarding?step=4">Пропустить</Link>
                </Button>
              </div>
            </form>
            {invites.length ? (
              <div className="rounded-md border border-border">
                {invites.map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 last:border-0">
                    <span className="text-sm">{i.email}</span>
                    <CopyButton text={`${appUrl}/join/${i.token}`} label="Ссылка" />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-5">
            <div>
              <h2 className="display text-3xl">Что дальше</h2>
              <p className="mt-1 text-sm text-muted-foreground">Ваш куратор — {partner.curator?.name ?? "назначается УК"}. Всё общение по запуску идёт через задачи и шаги плана.</p>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-3 rounded-md border border-border px-4 py-3">
                <span className="font-mono text-xs">01</span>
                <div>
                  <p>Проект запуска: {project ? `${project.tasks.length} шагов, 6 фаз` : "создаётся УК"}</p>
                  <p className="text-xs text-muted-foreground">Первые шаги: регистрация ИП, расчётный счёт, поиск помещения.</p>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-md border border-border px-4 py-3">
                <span className="font-mono text-xs">02</span>
                <div>
                  <p>Курс «{course?.title}» — {course?.lessons.length} уроков</p>
                  <p className="text-xs text-muted-foreground">Юрпакет, методичка запуска, открытие, маркетинг.</p>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-md border border-border px-4 py-3">
                <span className="font-mono text-xs">03</span>
                <div>
                  <p>База знаний: юрпакет, запуск, маркетинг, розница</p>
                  <p className="text-xs text-muted-foreground">Cmd+K — быстрый поиск из любого экрана.</p>
                </div>
              </li>
            </ul>
            <form action={onboardingFinish}>
              <Button type="submit" className="w-full">
                Начать работу
              </Button>
            </form>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
