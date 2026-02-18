import { safe } from "@orpc/client";
import { getSafeRedirect } from "@peated/web/lib/auth";
import { logError } from "@peated/web/lib/log";
import { getServerClient } from "@peated/web/lib/orpc/client.server";
import { getSession } from "@peated/web/lib/session.server";
import { redirect } from "next/navigation";

export async function GET(request: Request) {
  const { client } = await getServerClient();

  const { searchParams } = new URL(request.url);
  const redirectTo = getSafeRedirect(searchParams.get("redirectTo") || "/");
  const token = searchParams.get("token");
  if (!token) {
    throw new Error("No token provided");
  }

  const session = await getSession();
  const { data, error } = await safe(client.auth.magicLink.confirm({ token }));

  if (error) {
    logError(error);
    return redirect("/login?error=invalid-token");
  }

  session.user = data.user;
  session.accessToken = data.accessToken ?? null;
  session.ts = Math.floor(Date.now() / 1000);

  await session.save();

  if (!data.user.termsAcceptedAt) {
    redirect(`/auth/tos-required?redirectTo=${encodeURIComponent(redirectTo)}`);
  } else if (!data.user.verified) {
    redirect("/verify");
  } else {
    redirect(redirectTo);
  }
}
