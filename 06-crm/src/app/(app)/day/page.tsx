import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { STORE_ROLES } from "@/lib/access";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/fields";
import { DayChecklist } from "@/components/day-checklist";
import { courseProgress } from "@/lib/learning";

const OPENING = [
  "Открыть точку за 15 минут до начала, включить свет и вывеску",
  "Проверить кассу и терминал эквайринга, открыть смену в Hub",
  "Сверить остатки витрины с Hub (выборочно 5 позиций)",
  "Протереть витрины, выставить ценники по матрице УК",
  "Проверить зарядку демо-устройств",
  "Открыть Avito и мессенджеры, ответить на ночные сообщения",
];
const CLOSING = [
  "Пробить все продажи дня в Hub, проверить S/N",
  "Оформить возвраты и уценки, если были",
  "Снять Z-отчёт, сверить наличные с Hub",
  "Убрать устройства в сейф, закрыть смену в Hub",
  "Написать отчёт дня старшему смены / партнёру",
  "Выключить оборудование, поставить на охрану",
];

export default async function DayPage() {
  const user = await requireUser();
  if (!STORE_ROLES.includes(user.role) && user.role !== "partner") redirect("/");
  const [store, enrollment] = await Promise.all([
    user.storeId ? prisma.store.findUnique({ where: { id: user.storeId } }) : null,
    prisma.enrollment.findFirst({ where: { userId: user.id, course: { slug: "seller-day" } }, include: { course: { include: { lessons: true } }, progress: true } }),
  ]);
  const hubUrl = process.env.HUB_URL ?? "http://localhost:3000";
  const today = new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow={today} title="Рабочий день" description={store ? `${store.name} · ${store.address ?? ""}` : undefined} />

      <Card className="mb-6 flex items-center justify-between gap-3 px-5 py-4">
        <div>
          <p className="eyebrow">Розница</p>
          <p className="mt-1 text-sm">Продажи, склад, касса — в re:bar Hub</p>
        </div>
        <Button asChild size="sm">
          <a href={hubUrl} target="_blank" rel="noreferrer">
            <ExternalLink /> Открыть Hub
          </a>
        </Button>
      </Card>

      <DayChecklist storageKey={`day-${user.id}`} opening={OPENING} closing={CLOSING} today={new Date().toISOString().slice(0, 10)} />

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link href="/kb/chek-list-rabochego-dnya" className="block rounded-lg border border-border bg-card px-4 py-3 text-sm hover:bg-accent">
          <p className="eyebrow">Стандарт</p>
          <p className="mt-1">Полный чек-лист смены и зоны ответственности</p>
        </Link>
        <Link href="/learn/seller-day" className="block rounded-lg border border-border bg-card px-4 py-3 text-sm hover:bg-accent">
          <p className="eyebrow">Обучение</p>
          <p className="mt-1">
            Курс продавца {enrollment ? `· ${courseProgress(enrollment).pct}%` : ""}
          </p>
        </Link>
      </div>
    </div>
  );
}
