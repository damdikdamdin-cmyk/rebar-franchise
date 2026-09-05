import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { canAccessMarketing } from "@/lib/access";
import { MarketingTabs } from "@/components/marketing/tabs";

export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  if (!canAccessMarketing(user.role)) redirect("/");
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Маркетинг УК</p>
          <h1 className="display mt-1 text-4xl">Пространство маркетолога</h1>
        </div>
        <MarketingTabs />
      </div>
      {children}
    </div>
  );
}
