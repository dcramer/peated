import { safe } from "@orpc/client";
import { getSafeRedirect } from "@peated/web/lib/auth";
import { logError } from "@peated/web/lib/log";
import { client } from "@peated/web/lib/orpc/client";
import { getSession } from "@peated/web/lib/session.server";
import { redirect } from "next/navigation";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const redirectTo = searchParams.get("redirectTo");
  const token = searchParams.get("token");
  if (!token) {
    throw new Error("No token provided");
  }

  const session = await getSession();
  const { data, error } = await safe(client.auth.magicLink.confirm({ token }));

  if (error) {
    logError(error);
    // in an ideal world this would simply render a component with the error,
    // but Next does not allow us to mutate the session in RSC, and there's no
    // way to render a component via route handlers afaik.
    return redirect("/login?error=invalid-token");
  }

  session.user = data.user;
  session.accessToken = data.accessToken ?? null;

  await session.save();

  redirect(getSafeRedirect(redirectTo || "/"));
}
