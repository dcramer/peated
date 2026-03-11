"use server";

import { safe } from "@orpc/client";
import { createServerClient } from "@peated/web/lib/orpc/client.server";
import { redirect } from "next/navigation";
import { getSafeRedirect } from "./auth";
import type { SessionData } from "./session.server";
import { getSession } from "./session.server";

const SESSION_REFRESH = 60 * 60; // 1 hour
const INTERNAL_SERVER_ERROR = "Internal server error.";

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

  if (email && !password) {
    const result = await safeClientCall(
      client.auth.magicLink.create({ email }),
      INTERNAL_SERVER_ERROR,
    );
    if (!result.ok) {
      return {
        magicLink: false,
        error: result.errorMessage,
      };
    }

    return {
      magicLink: true,
      error: null,
    };
  }

  const result = await safeClientCall(
    passkeyResponse && signedChallenge
      ? client.auth.passkey.authenticateVerify({
          response: JSON.parse(passkeyResponse),
          signedChallenge,
        })
      : code
        ? client.auth.login({
            code,
          })
        : client.auth.login({
            email,
            password,
          }),
    INTERNAL_SERVER_ERROR,
  );

  if (!result.ok) {
    return {
      magicLink: false,
      error: result.errorMessage,
    };
  }

  await saveAuthSession(session, result.data);
  redirectAfterAuth(result.data.user, redirectTo);
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

  const email = (formData.get("email") || "") as string;
  const password = (formData.get("password") || "") as string;
  const username = formData.get("username") as string;
  const passkeyResponse = formData.get("passkeyResponse") as string | null;
  const signedChallenge = formData.get("signedChallenge") as string | null;
  const tosAccepted = Boolean(formData.get("tosAccepted"));

  const { client } = await createServerClient();

  const result = await safeClientCall(
    client.auth.register({
      email,
      password,
      username,
      ...(passkeyResponse && signedChallenge
        ? {
            passkeyResponse: JSON.parse(passkeyResponse),
            signedChallenge,
          }
        : {}),
      tosAccepted,
    }),
    INTERNAL_SERVER_ERROR,
  );

  if (!result.ok) {
    return { ok: false, error: result.errorMessage };
  }

  await saveAuthSession(session, result.data);
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

  const { client } = await createServerClient();
  const result = await safeClientCall(
    client.email.resendVerification(),
    INTERNAL_SERVER_ERROR,
  );

  if (!result.ok && result.isDefined && result.error?.name === "CONFLICT") {
    return { ok: true, alreadyVerified: true };
  }

  if (!result.ok) {
    return { ok: false, error: result.errorMessage };
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

  const result = await safeClientCall(
    client.auth.tos.accept(),
    INTERNAL_SERVER_ERROR,
    true,
  );

  if (!result.ok) {
    return { ok: false, error: result.errorMessage } as GenericResult;
  }

  await saveAuthSession(session, {
    user: result.data,
  });

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

  const { client } = await createServerClient();

  const result = await safeClientCall(
    client.auth.recovery.create({ email }),
    INTERNAL_SERVER_ERROR,
  );

  if (!result.ok) {
    return { ok: false, error: result.errorMessage };
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

  const result = await safeClientCall(
    client.auth.recovery.confirm({ token, password }),
    INTERNAL_SERVER_ERROR,
  );

  if (!result.ok) {
    return { ok: false, error: result.errorMessage };
  }

  await saveAuthSession(session, result.data);

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

  const result = await safeClientCall(
    client.auth.recovery.confirmPasskey({
      token,
      passkeyResponse: JSON.parse(passkeyResponse),
      signedChallenge,
    }),
    INTERNAL_SERVER_ERROR,
  );

  if (!result.ok) {
    return { ok: false, error: result.errorMessage };
  }

  await saveAuthSession(session, result.data);

  return { ok: true };
}

export async function updateSession(): Promise<SessionData> {
  "use server";

  const session = await getSession();
  const { client } = await createServerClient();

  try {
    const user = await client.users.details({ user: "me" });
    await saveAuthSession(session, {
      user,
    });
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
    throw err;
  }
}

type Session = Awaited<ReturnType<typeof getSession>>;

type SafeClientCallFailure = {
  error: {
    message: string;
    name?: string;
  };
  errorMessage: string;
  isDefined: boolean;
  ok: false;
};

type SafeClientCallResult<T> =
  | {
      data: T;
      ok: true;
    }
  | SafeClientCallFailure;

async function safeClientCall<T>(
  promise: Promise<T>,
  fallbackMessage: string,
  useMessageForAnyError = false,
): Promise<SafeClientCallResult<T>> {
  const { data, error, isDefined } = await safe(promise);

  if (!error) {
    return {
      data,
      ok: true,
    };
  }

  return {
    error,
    errorMessage:
      isDefined || useMessageForAnyError ? error.message : fallbackMessage,
    isDefined,
    ok: false,
  };
}

function getSessionTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

async function saveAuthSession(
  session: Session,
  payload: {
    accessToken?: string | null;
    user: NonNullable<SessionData["user"]>;
  },
): Promise<void> {
  session.user = payload.user;

  if (payload.accessToken !== undefined) {
    session.accessToken = payload.accessToken ?? null;
  }

  session.ts = getSessionTimestamp();
  await session.save();
}

function redirectAfterAuth(
  user: NonNullable<SessionData["user"]>,
  redirectTo: string,
): never {
  if (!user.termsAcceptedAt) {
    redirect(`/auth/tos-required?redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  if (!user.verified) {
    redirect("/verify");
  }

  redirect(redirectTo);
}
