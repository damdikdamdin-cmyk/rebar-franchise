import { redirect } from "next/navigation";

/** Hub перенесён в re:bar OS. */
export default function HubDeprecatedRedirect() {
  redirect(process.env.OS_URL ?? "http://localhost:3100");
}
