"use server";

import { isDefinedError } from "@orpc/client";
import { makeORPCClient } from "@peated/server/orpc/client";
import config from "@peated/web/config";
import { redirect } from "next/navigation";
import { getSafeRedirect } from "./auth";
import type { SessionData } from "./session.server";
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

type AuthenticateFormResult = {
  magicLink: boolean;
  error: string | null;
};

export async function authenticateForm(
  prevState: AuthenticateFormResult | undefined,
  formData: FormData,
) {
  "use server";

  return await authenticate(formData);
}

export async function authenticate(
  formData: FormData,
): Promise<AuthenticateFormResult | undefined> {
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

  const orpcClient = makeORPCClient(config.API_SERVER, session.accessToken);

  if (email && !password) {
    try {
      await trpcClient.authMagicLinkSend.mutate({ email });
    } catch (err: any) {
      if (isDefinedError(err) && err.data?.code === "UNAUTHORIZED") {
        return {
          magicLink: false,
          error: "Invalid credentials",
        };
      }

      throw err;
    }

    return {
      magicLink: true,
      error: null,
    };
  }

  let data;
  try {
    data = code
      ? await orpcClient.auth.login({
          code,
        })
      : await orpcClient.auth.login({
          email,
          password,
        });

    session.user = data.user;
    session.accessToken = data.accessToken;

    await session.save();

    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/303
    // not using redirect() yet: https://github.com/vercel/next.js/issues/51592#issuecomment-1810212676
  } catch (err: any) {
    if (isDefinedError(err) && err.data?.code === "UNAUTHORIZED") {
      return {
        magicLink: false,
        error: "Invalid credentials",
      };
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
  session.ts = new Date().getTime();

  await session.save();

  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/303
  // not using redirect() yet: https://github.com/vercel/next.js/issues/51592#issuecomment-1810212676

  return redirect("/verify");
}

type GenericResult = {
  ok: boolean;
};

export async function resendVerificationForm(
  prevState?:
    | (GenericResult & {
        alreadyVerified?: boolean;
      })
    | undefined,
  formData?: FormData,
) {
  "use server";

  const session = await getSession();

  const trpcClient = makeTRPCClient(config.API_SERVER, session.accessToken);
  try {
    await trpcClient.emailResendVerification.mutate();
  } catch (err) {
    if (isTRPCClientError(err) && err.data?.code === "CONFLICT") {
      return { ok: true, alreadyVerified: true };
    }

    throw err;
  }

  return { ok: true };
}

export async function passwordResetForm(
  prevState: GenericResult | undefined,
  formData: FormData,
) {
  "use server";

  const email = (formData.get("email") || "") as string;

  const session = await getSession();

  const trpcClient = makeTRPCClient(config.API_SERVER, session.accessToken);
  try {
    await trpcClient.authPasswordReset.mutate({ email });
  } catch (err) {
    if (isTRPCClientError(err)) {
      return { ok: false, error: err.message };
    }

    throw err;
  }

  return { ok: true };
}

export async function passwordResetConfirmForm(
  prevState: GenericResult | undefined,
  formData: FormData,
) {
  "use server";

  const token = (formData.get("token") || "") as string;
  const password = (formData.get("password") || "") as string;

  const session = await getSession();

  const trpcClient = makeTRPCClient(config.API_SERVER, session.accessToken);

  let data;
  try {
    data = await trpcClient.authPasswordResetConfirm.mutate({
      token,
      password,
    });
  } catch (err) {
    if (isTRPCClientError(err)) {
      return { ok: false, error: err.message };
    }

    throw err;
  }

  session.user = data.user;
  session.accessToken = data.accessToken;
  session.ts = new Date().getTime();

  await session.save();

  return { ok: true };
}

export async function updateSession(): Promise<SessionData> {
  "use server";

  const session = await getSession();
  const trpcClient = makeTRPCClient(config.API_SERVER, session.accessToken);

  const user = await trpcClient.userById.query("me");
  session.user = user;
  session.ts = new Date().getTime();
  // should rotate access token too
  // session.accessToken = data.accessToken;
  await session.save();

  return {
    ...session,
  };
}

const SESSION_REFRESH = 60;

export async function ensureSessionSynced(): Promise<SessionData> {
  "use server";

  let session: SessionData = { ...(await getSession()) };
  if (!session.user) return session;

  if (
    !session.ts ||
    session.ts < new Date().getTime() / 1000 - SESSION_REFRESH
  ) {
    console.log(`Refreshing session for user_id='${session.user.id}'`);
    session = await updateSession();
  }

  return {
    ...session,
  };
}
