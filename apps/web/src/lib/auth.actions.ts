"use server";

import { safe } from "@orpc/client";
import type { Inputs } from "@peated/server/orpc/router";
import { createServerClient } from "@peated/web/lib/orpc/client.server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSafeRedirect } from "./auth";
import { logInfo, logTelemetryError } from "./log";
import { getRegistrationConflictField } from "./registration";
import type { SessionData } from "./session.server";
import { getSession } from "./session.server";

const SESSION_REFRESH = 60 * 60; // 1 hour
const INTERNAL_SERVER_ERROR = "Internal server error.";

function getFormString(formData: FormData, name: string): string {
  const value = z.string().safeParse(formData.get(name));
  return value.success ? value.data : "";
}

function getOptionalFormString(
  formData: FormData,
  name: string,
): string | null {
  const value = z.string().safeParse(formData.get(name));
  return value.success ? value.data : null;
}

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
    formData ? getFormString(formData, "redirectTo") || "/" : null,
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

  const email = getFormString(formData, "email");
  const password = getFormString(formData, "password");
  const code = getFormString(formData, "code");
  const passkeyResponse = getOptionalFormString(formData, "passkeyResponse");
  const signedChallenge = getOptionalFormString(formData, "signedChallenge");
  const redirectTo = getSafeRedirect(
    getFormString(formData, "redirectTo") || "/",
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

  const email = getFormString(formData, "email");
  const password = getFormString(formData, "password");
  const username = getFormString(formData, "username");
  const passkeyResponse = getOptionalFormString(formData, "passkeyResponse");
  const signedChallenge = getOptionalFormString(formData, "signedChallenge");
  const tosAccepted = Boolean(formData.get("tosAccepted"));

  const { client } = await createServerClient();

  const input: Inputs["auth"]["register"] = {
    email,
    password,
    username,
    tosAccepted,
  };
  if (passkeyResponse && signedChallenge) {
    input.passkeyResponse = JSON.parse(passkeyResponse);
    input.signedChallenge = signedChallenge;
  }
  const result = await safeClientCall(
    client.auth.register(input),
    INTERNAL_SERVER_ERROR,
  );

  if (!result.ok) {
    const conflictField = getRegistrationConflictField(result.error);
    const failure: GenericResult & { conflictField?: typeof conflictField } = {
      ok: false,
      error: result.errorMessage,
    };
    if (conflictField) failure.conflictField = conflictField;
    return failure;
  }

  await saveAuthSession(session, result.data);
  return redirect("/verify");
}

type GenericResult = {
  ok: boolean;
  error?: string;
};

export async function resendVerificationForm(
  prevState?: GenericResult & {
    alreadyVerified?: boolean;
  },
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
    getFormString(formData, "redirectTo") || "/",
  );

  return await acceptTos(redirectTo);
}

export async function acceptTos(redirectTo?: string): Promise<GenericResult> {
  "use server";

  const session = await getSession();
  const { client } = await createServerClient();

  const result = await safeClientCall(
    client.auth.tos.accept(),
    INTERNAL_SERVER_ERROR,
    true,
  );

  if (!result.ok) {
    return { ok: false, error: result.errorMessage };
  }

  await saveAuthSession(session, {
    user: result.data,
  });

  if (redirectTo) {
    redirect(redirectTo);
  }

  return { ok: true };
}

export async function passwordResetForm(
  prevState: GenericResult | undefined,
  formData: FormData,
) {
  "use server";

  const email = getFormString(formData, "email");

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

  const token = getFormString(formData, "token");
  const password = getFormString(formData, "password");

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

  const token = getFormString(formData, "token");
  const passkeyResponse = getFormString(formData, "passkeyResponse");
  const signedChallenge = getFormString(formData, "signedChallenge");

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
    logTelemetryError(err, {
      extra: {
        message: "Failed to refresh session",
      },
    });
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
      logInfo("Refreshing session for user {userId}", {
        extra: {
          userId: session.user.id,
        },
      });
      session = await updateSession();
    }

    return {
      ...session,
    };
  } catch (err) {
    logTelemetryError(err, {
      extra: {
        message: "ensureSessionSynced failed",
      },
    });
    throw err;
  }
}

type Session = Awaited<ReturnType<typeof getSession>>;

type SafeClientCallFailure = {
  error: {
    data?: unknown;
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
