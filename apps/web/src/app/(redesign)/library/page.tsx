import { redirectToAuth } from "@peated/web/lib/auth";
import { getCurrentUser } from "@peated/web/lib/auth.server";
import { redirect } from "next/navigation";

export default async function LibraryPage() {
  const user = await getCurrentUser();
  if (!user) return redirectToAuth({ pathname: "/library" });
  redirect(`/users/${user.username}/library`);
}
