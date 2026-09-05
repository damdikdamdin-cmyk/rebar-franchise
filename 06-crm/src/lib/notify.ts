import { prisma } from "@/lib/prisma";
import { notifyTelegram } from "@/lib/telegram";

export async function notifyUsers(userIds: string[], title: string, body?: string, href?: string) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return;
  await prisma.notification.createMany({
    data: unique.map((userId) => ({ userId, title, body: body ?? null, href: href ?? null })),
  });
}

export async function notifyRoles(roles: string[], title: string, body?: string, href?: string) {
  const users = await prisma.user.findMany({
    where: { role: { in: roles as never[] } },
    select: { id: true },
  });
  await notifyUsers(
    users.map((u) => u.id),
    title,
    body,
    href,
  );
}

export async function broadcast(title: string, body?: string, href?: string, telegramChat?: string | null) {
  await notifyTelegram([title, body].filter(Boolean).join("\n"), telegramChat);
}
