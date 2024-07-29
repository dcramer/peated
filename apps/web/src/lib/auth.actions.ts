"use server";

import { makeTRPCClient } from "@peated/server/trpc/client";
import config from "@peated/web/config";
import { isTRPCClientError } from "@peated/web/lib/trpc/client";
import { redirect } from "next/navigation";
import { getSafeRedirect } from "./auth";
import { getSession } from "./session.server";

export async function logoutForm(
  prevState: void | undefined,
  formData: FormData,
) {
  "use server";

  return await logout(formData);
}

export async function logout(formData?: FormData) {
  "use server";

  const redirectTo = getSafeRedirect(
    formData ? ((formData.get("redirectTo") || "/") as string) : null,
  );

  const session = await getSession();
  session.destroy();
  redirect(redirectTo);
}

export async function authenticateForm(
  prevState: string | undefined,
  formData: FormData,
) {
  "use server";

  return await authenticate(formData);
}

export async function authenticate(formData: FormData) {
  "use server";

  const session = await getSession();

  // const url = new URL(request.url);
  // const redirectTo = url.searchParams.get("redirectTo");
  // const form = await request.formData();

  const email = (formData.get("email") || "") as string;
  const password = (formData.get("password") || "") as string;
  const code = formData.get("code") as string;
  const redirectTo = getSafeRedirect(
    (formData.get("redirectTo") || "/") as string,
  );

  const trpcClient = makeTRPCClient(config.API_SERVER, session.accessToken);

  let data;
  try {
    data = code
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

  if (!data.user.verified) {
    redirect("/verify");
  } else {
    redirect(redirectTo);
  }
}

export async function registerForm(
  prevState: string | undefined,
  formData: FormData,
) {
  "use server";

  return await register(formData);
}

export async function register(formData: FormData) {
  "use server";

  const session = await getSession();

  // const url = new URL(request.url);
  // const redirectTo = url.searchParams.get("redirectTo");
  // const form = await request.formData();

  const email = (formData.get("email") || "") as string;
  const password = (formData.get("password") || "") as string;
  const username = formData.get("username") as string;

  const trpcClient = makeTRPCClient(config.API_SERVER, session.accessToken);

  let data;
  try {
    data = await trpcClient.authRegister.mutate({
      email,
      password,
      username,
    });
  } catch (err) {
    if (isTRPCClientError(err) && err.data?.code === "CONFLICT") {
      return "An account already exists matching that username or email address.";
    }

    throw err;
  }

  session.user = data.user;
  session.accessToken = data.accessToken;

  await session.save();

  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/303
  // not using redirect() yet: https://github.com/vercel/next.js/issues/51592#issuecomment-1810212676

  return redirect("/verify");
}

type ResendResult = {
  ok: boolean;
};

export async function resendVerificationForm(
  prevState?: ResendResult | undefined,
  formData?: FormData,
) {
  "use server";

  const session = await getSession();

  const trpcClient = makeTRPCClient(config.API_SERVER, session.accessToken);
  await trpcClient.emailResendVerification.mutate();

  return { ok: true };
}

export async function updateSession() {
  "use server";

  const session = await getSession();
  const trpcClient = makeTRPCClient(config.API_SERVER, session.accessToken);

  const user = await trpcClient.userById.query("me");
  session.user = user;
  // should rotate access token too
  // session.accessToken = data.accessToken;
  session.save();

  return session;
}
