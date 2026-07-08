import { redirectToAuth } from "@peated/web/lib/auth";
import { getCurrentUser } from "@peated/web/lib/auth.server";
import { redirect } from "next/navigation";

export const fetchCache = "default-no-store";

export default async function Page() {
  const user = await getCurrentUser();

  if (!user) {
    return redirectToAuth({ pathname: "/library" });
  }

  return redirect(`/users/${user.username}/library`);
}
