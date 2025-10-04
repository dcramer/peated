"use server";

import { safe } from "@orpc/client";
import { createServerClient } from "@peated/web/lib/orpc/client.server";
import { redirect } from "next/navigation";
import { getSafeRedirect } from "./auth";
import type { SessionData } from "./session.server";
import { getSession } from "./session.server";

const SESSION_REFRESH = 60 * 60; // 1 hour

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
  requestId?: string;
  expiresIn?: number;
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
  const code = (formData.get("code") || "") as string;
  const requestId = (formData.get("requestId") || "") as string;
  const redirectTo = getSafeRedirect(
    (formData.get("redirectTo") || "/") as string,
  );

  const { client } = await createServerClient();

  if (email && !password && !code) {
    const { error, isDefined, data } = await safe(
      client.auth.magicLink.start({ email }),
    );
    if (isDefined) {
      return {
        magicLink: false,
        error: error.message,
      };
    } else if (error) {
      return {
        magicLink: false,
        error: "Internal server error.",
      };
    }

    return {
      magicLink: true,
      error: null,
      requestId: data.requestId,
      expiresIn: data.expiresIn,
    };
  }

  const { error, isDefined, data } = await safe(
    code && requestId
      ? client.auth.magicLink.verify({ requestId, code })
      : client.auth.login({
          email,
          password,
        }),
  );

  if (isDefined) {
    // If we were in code flow, keep the magicLink UI open
    if (code && requestId) {
      return {
        magicLink: true,
        error: error.message,
        requestId,
      };
    }
    return { magicLink: false, error: error.message };
  } else if (error) {
    if (code && requestId) {
      return {
        magicLink: true,
        error: "Internal server error.",
        requestId,
      };
    }
    return { magicLink: false, error: "Internal server error." };
  }

  session.user = data.user;
  session.accessToken = data.accessToken ?? null;

  await session.save();

  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/303
  // not using redirect() yet: https://github.com/vercel/next.js/issues/51592#issuecomment-1810212676

  if (!data.user.termsAcceptedAt) {
    redirect(`/auth/tos-required?redirectTo=${encodeURIComponent(redirectTo)}`);
  } else if (!data.user.verified) {
    redirect("/verify");
  } else {
    redirect(redirectTo);
  }
}

export async function registerForm(
  prevState: GenericResult | undefined,
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

  const { client } = await createServerClient();

  const { error, isDefined, data } = await safe(
    client.auth.register({
      email,
      password,
      username,
      tosAccepted: formData.get("tosAccepted") ? true : false,
    }),
  );

  if (isDefined) {
    return { ok: false, error: error.message };
  } else if (error) {
    return { ok: false, error: "Internal server error." };
  }

  session.user = data.user;
  session.accessToken = data.accessToken ?? null;
  session.ts = new Date().getTime();

  await session.save();

  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/303
  // not using redirect() yet: https://github.com/vercel/next.js/issues/51592#issuecomment-1810212676

  return redirect("/verify");
}

type GenericResult = {
  ok: boolean;
  error?: string;
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

  const { client } = await createServerClient();
  const { isDefined, error } = await safe(client.email.resendVerification());

  if (isDefined && error.name === "CONFLICT") {
    return { ok: true, alreadyVerified: true };
  } else if (error) {
    return { ok: false, error: "Internal server error." };
  }

  return { ok: true };
}

export async function acceptTosForm(
  prevState: GenericResult | undefined,
  formData: FormData,
) {
  "use server";

  const redirectTo = getSafeRedirect(
    (formData.get("redirectTo") || "/") as string,
  );

  return await acceptTos(redirectTo);
}

export async function acceptTos(redirectTo?: string) {
  "use server";

  const session = await getSession();
  const { client } = await createServerClient();

  const { error, data } = await safe(client.auth.acceptTos());

  if (error) {
    return { ok: false, error: error.message } as GenericResult;
  }

  session.user = data;
  await session.save();

  if (redirectTo) {
    redirect(redirectTo);
  }

  return { ok: true } as GenericResult;
}

export async function passwordResetForm(
  prevState: GenericResult | undefined,
  formData: FormData,
) {
  "use server";

  const email = (formData.get("email") || "") as string;

  const session = await getSession();
  const { client } = await createServerClient();

  const { error, isDefined } = await safe(
    client.auth.passwordReset.create({ email }),
  );

  if (isDefined) {
    return { ok: false, error: error.message };
  } else if (error) {
    return { ok: false, error: "Internal server error." };
  }

  return { ok: true };
}

type ResendResult = { ok: boolean; error?: string };
export async function resendMagicLinkForm(
  prevState: ResendResult | undefined,
  formData: FormData,
): Promise<ResendResult> {
  "use server";

  const requestId = (formData.get("requestId") || "") as string;
  if (!requestId) return { ok: false, error: "Missing requestId." };

  const { client } = await createServerClient();
  const { error, isDefined, data } = await safe(
    client.auth.magicLink.resend({ requestId }),
  );
  if (isDefined) return { ok: false, error: error.message };
  if (error) return { ok: false, error: "Internal server error." };
  return { ok: true, expiresIn: data.expiresIn } as any;
}

export async function passwordResetConfirmForm(
  prevState: GenericResult | undefined,
  formData: FormData,
) {
  "use server";

  const token = (formData.get("token") || "") as string;
  const password = (formData.get("password") || "") as string;

  const session = await getSession();
  const { client } = await createServerClient();

  const { error, isDefined, data } = await safe(
    client.auth.passwordReset.confirm({ token, password }),
  );

  if (isDefined) {
    return { ok: false, error: error.message };
  } else if (error) {
    return { ok: false, error: "Internal server error." };
  }

  session.user = data.user;
  session.accessToken = data.accessToken ?? null;
  session.ts = new Date().getTime();

  await session.save();

  return { ok: true };
}

export async function updateSession(): Promise<SessionData> {
  "use server";

  const session = await getSession();
  const { client } = await createServerClient();

  const user = await client.users.details({ user: "me" });
  session.user = user;
  session.ts = new Date().getTime();
  // should rotate access token too
  // session.accessToken = data.accessToken;
  await session.save();

  return {
    ...session,
  };
}

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
