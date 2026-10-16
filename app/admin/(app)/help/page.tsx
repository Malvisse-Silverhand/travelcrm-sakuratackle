import { redirect } from "next/navigation";
import { getOperatorProfile } from "@/lib/admin/operator";
import { HELP_TOPICS, topicVisibleTo } from "@/lib/admin/help";

/** /admin/help opens on the first topic the signed-in role can see. */
export default async function HelpIndex() {
  const profile = await getOperatorProfile();
  if (!profile) redirect("/admin/login");
  const first = HELP_TOPICS.find((t) => topicVisibleTo(t, profile.role)) ?? HELP_TOPICS[0];
  redirect(`/admin/help/${first.slug}`);
}
