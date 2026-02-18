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
  const passkeyResponse = formData.get("passkeyResponse") as string | null;
  const signedChallenge = formData.get("signedChallenge") as string | null;
  const redirectTo = getSafeRedirect(
    (formData.get("redirectTo") || "/") as string,
  );

  const { client } = await createServerClient();

  // Handle passkey authentication
  if (passkeyResponse && signedChallenge) {
    const { error, isDefined, data } = await safe(
      client.auth.passkey.authenticateVerify({
        response: JSON.parse(passkeyResponse),
        signedChallenge,
      }),
    );

    if (error) {
      return {
        magicLink: false,
        error: isDefined ? error.message : "Internal server error.",
      };
    }

    session.user = data.user;
    session.accessToken = data.accessToken ?? null;
    session.ts = Math.floor(Date.now() / 1000);
    await session.save();

    if (!data.user.termsAcceptedAt) {
      redirect(
        `/auth/tos-required?redirectTo=${encodeURIComponent(redirectTo)}`,
      );
    } else if (!data.user.verified) {
      redirect("/verify");
    } else {
      redirect(redirectTo);
    }
  }

  if (email && !password) {
    const { error, isDefined } = await safe(
      client.auth.magicLink.create({ email }),
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
    };
  }

  const { error, isDefined, data } = await safe(
    code
      ? client.auth.login({
          code,
        })
      : client.auth.login({
          email,
          password,
        }),
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

  session.user = data.user;
  session.accessToken = data.accessToken ?? null;
  session.ts = Math.floor(Date.now() / 1000);

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
  const passkeyResponse = formData.get("passkeyResponse") as string | null;
  const signedChallenge = formData.get("signedChallenge") as string | null;

  const { client } = await createServerClient();

  // Handle passkey registration
  if (passkeyResponse && signedChallenge) {
    const { error, isDefined, data } = await safe(
      client.auth.register({
        username,
        email,
        passkeyResponse: JSON.parse(passkeyResponse),
        signedChallenge,
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
    session.ts = Math.floor(Date.now() / 1000);

    await session.save();

    return redirect("/verify");
  }

  // Handle password registration
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
  session.ts = Math.floor(Date.now() / 1000);

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

  const { error, data } = await safe(client.auth.tos.accept());

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
    client.auth.recovery.create({ email }),
  );

  if (isDefined) {
    return { ok: false, error: error.message };
  } else if (error) {
    return { ok: false, error: "Internal server error." };
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
  const { client } = await createServerClient();

  const { error, isDefined, data } = await safe(
    client.auth.recovery.confirm({ token, password }),
  );

  if (isDefined) {
    return { ok: false, error: error.message };
  } else if (error) {
    return { ok: false, error: "Internal server error." };
  }

  session.user = data.user;
  session.accessToken = data.accessToken ?? null;
  session.ts = Math.floor(Date.now() / 1000);

  await session.save();

  return { ok: true };
}

export async function passwordResetConfirmPasskeyForm(
  prevState: GenericResult | undefined,
  formData: FormData,
) {
  "use server";

  const token = (formData.get("token") || "") as string;
  const passkeyResponse = formData.get("passkeyResponse") as string;
  const signedChallenge = formData.get("signedChallenge") as string;

  const session = await getSession();
  const { client } = await createServerClient();

  const { error, isDefined, data } = await safe(
    client.auth.recovery.confirmPasskey({
      token,
      passkeyResponse: JSON.parse(passkeyResponse),
      signedChallenge,
    }),
  );

  if (isDefined) {
    return { ok: false, error: error.message };
  } else if (error) {
    return { ok: false, error: "Internal server error." };
  }

  session.user = data.user;
  session.accessToken = data.accessToken ?? null;
  session.ts = Math.floor(Date.now() / 1000);

  await session.save();

  return { ok: true };
}

export async function updateSession(): Promise<SessionData> {
  "use server";

  const session = await getSession();
  const { client } = await createServerClient();

  try {
    const user = await client.users.details({ user: "me" });
    session.user = user;
    session.ts = Math.floor(Date.now() / 1000);
    // should rotate access token too
    // session.accessToken = data.accessToken;
    await session.save();
  } catch (err: any) {
    if (err?.name === "UNAUTHORIZED" || err?.status === 401) {
      session.destroy();
      return { user: null, accessToken: null, ts: null };
    }
    console.error("Failed to refresh session:", err);
  }

  return {
    ...session,
  };
}

export async function ensureSessionSynced(): Promise<SessionData> {
  "use server";

  try {
    let session: SessionData = { ...(await getSession()) };
    if (!session.user) return session;

    if (!session.ts || session.ts < Date.now() / 1000 - SESSION_REFRESH) {
      console.log(`Refreshing session for user_id='${session.user.id}'`);
      session = await updateSession();
    }

    return {
      ...session,
    };
  } catch (err) {
    console.error("ensureSessionSynced failed:", err);
    return { user: null, accessToken: null, ts: null };
  }
}
