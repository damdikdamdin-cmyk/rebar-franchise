import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { navFor } from "@/lib/nav";
import { ROLE_LABEL, roleCanSee } from "@/lib/access";
import { Rail } from "@/components/shell/rail";
import { CommandPalette } from "@/components/shell/command-palette";
import { Inbox } from "@/components/shell/inbox";
import { TopBar } from "@/components/shell/top-bar";

export async function AppShell({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const nav = navFor(user.role);

  const [notifications, articles, context] = await Promise.all([
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.kbArticle.findMany({
      where: { status: "published" },
      select: { title: true, slug: true, visibleRoles: true, space: { select: { name: true, visibleRoles: true } } },
      orderBy: { title: "asc" },
    }),
    user.partnerId
      ? prisma.partner.findUnique({ where: { id: user.partnerId }, select: { name: true, city: true } })
      : user.storeId
        ? prisma.store.findUnique({ where: { id: user.storeId }, select: { name: true, city: true } })
        : null,
  ]);

  const visibleArticles = articles
    .filter((a) => roleCanSee(user.role, a.space.visibleRoles) && roleCanSee(user.role, a.visibleRoles))
    .map((a) => ({ title: a.title, href: `/kb/${a.slug}`, space: a.space.name }));

  const contextLabel = context ? `${context.city} · ${context.name}` : "Управляющая компания";

  return (
    <div className="flex min-h-screen">
      <Rail nav={nav} user={{ name: user.name ?? "", role: ROLE_LABEL[user.role], context: contextLabel }} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar>
          <CommandPalette nav={nav} articles={visibleArticles} />
          <Inbox items={notifications} />
        </TopBar>
        <main className="flex-1 px-4 pb-16 pt-6 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
