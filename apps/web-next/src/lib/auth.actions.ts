"use server";

import { makeTRPCClient } from "@peated/server/src/lib/trpc";
import config from "@peated/web/config";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "./session.server";
import { isTRPCClientError } from "./trpc";

export async function logout(
  prevState?: any,
  formData?: FormData,
  redirectTo = "/",
) {
  const session = await getSession();
  session.destroy();
  revalidatePath(redirectTo);
}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
  redirectTo = "/",
) {
  "use server";

  const session = await getSession();

  // const url = new URL(request.url);
  // const redirectTo = url.searchParams.get("redirectTo");
  // const form = await request.formData();

  const email = (formData.get("email") || "") as string;
  const password = (formData.get("password") || "") as string;
  const code = formData.get("code") as string;

  const trpcClient = makeTRPCClient(config.API_SERVER, session.accessToken);

  try {
    const data = code
      ? await trpcClient.authGoogle.mutate({
          code,
        })
      : await trpcClient.authBasic.mutate({
          email,
          password,
        });

    session.user = data.user;
    session.accessToken = data.accessToken;

    await session.save();

    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/303
    // not using redirect() yet: https://github.com/vercel/next.js/issues/51592#issuecomment-1810212676
  } catch (err) {
    if (isTRPCClientError(err) && err.data?.code === "UNAUTHORIZED") {
      return "Invalid credentials";
    }

    throw err;
  }

  revalidatePath("/login");
  revalidatePath(redirectTo);
  redirect(redirectTo);
}
