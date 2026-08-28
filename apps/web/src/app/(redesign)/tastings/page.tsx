import { redirectToAuth } from "@peated/web/lib/auth";
import { getCurrentUser } from "@peated/web/lib/auth.server";
import { redirect } from "next/navigation";

export default async function TastingsPage() {
  const user = await getCurrentUser();
  if (!user) return redirectToAuth({ pathname: "/tastings" });
  redirect(`/users/${user.username}`);
}
