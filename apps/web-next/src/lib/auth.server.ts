import { makeTRPCClient } from "@peated/server/src/lib/trpc";
import config from "@peated/web/config";
import { getSession } from "@peated/web/lib/session.server";
import { TRPCClientError } from "@trpc/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const trpc = makeTRPCClient(config.API_SERVER, "");

export async function getCurrentUser() {
  const session = await getSession();
  return session.user;
}

export async function isLoggedIn() {
  const session = await getSession();
  return !!session.user;
}

export async function logout() {
  "use server";

  const session = await getSession();
  session.destroy();
  revalidatePath("/");
}

export async function authenticate(formData: FormData, redirectTo = "/") {
  "use server";

  const session = await getSession();

  // const url = new URL(request.url);
  // const redirectTo = url.searchParams.get("redirectTo");
  // const form = await request.formData();

  const email = (formData.get("email") || "") as string;
  const password = (formData.get("password") || "") as string;
  const code = formData.get("code") as string;

  try {
    const data = code
      ? await trpc.authGoogle.mutate({
          code,
        })
      : await trpc.authBasic.mutate({
          email,
          password,
        });

    session.user = data.user;
    session.accessToken = data.accessToken;

    await session.save();

    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/303
    // not using redirect() yet: https://github.com/vercel/next.js/issues/51592#issuecomment-1810212676
  } catch (err) {
    if (err instanceof TRPCClientError && err.data.code === "UNAUTHORIZED") {
      return Response.json({ error: "Invalid credentials" });
    }

    throw err;
  }

  revalidatePath("/login");
  return redirect(redirectTo);
}