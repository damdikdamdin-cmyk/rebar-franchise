import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { SessionUser } from "@/lib/access";

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
    partnerId: session.user.partnerId,
    storeId: session.user.storeId,
  };
}

export async function optionalUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
    partnerId: session.user.partnerId,
    storeId: session.user.storeId,
  };
}
