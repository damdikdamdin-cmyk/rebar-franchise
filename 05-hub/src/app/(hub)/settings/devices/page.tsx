import { requireUser } from "@/lib/session";
import { DevicesClient } from "@/components/print/devices-client";

export default async function DevicesPage() {
  await requireUser();
  return <DevicesClient />;
}
