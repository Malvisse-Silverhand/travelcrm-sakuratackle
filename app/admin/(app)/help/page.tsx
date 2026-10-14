import { redirect } from "next/navigation";
import { HELP_TOPICS } from "@/lib/admin/help";

/** /admin/help opens on the first topic. */
export default function HelpIndex() {
  redirect(`/admin/help/${HELP_TOPICS[0].slug}`);
}
