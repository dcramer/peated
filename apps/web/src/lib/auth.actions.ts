import { safe } from "@orpc/client";
import { useMutation } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { z } from "zod";
import { getSafeRedirect } from "./auth";
import { createBrowserClient } from "./orpc/client";

const SESSION_REFRESH = 60 * 60; // 1 hour

// Client-side session management
const SESSION_KEY = "peated_session";

export interface SessionData {
  user: any | null;
  accessToken: string | null;
  ts: number | null;
}

const defaultSession: SessionData = {
  user: null,
  accessToken: null,
  ts: null,
};

// Session utilities
export function getSession(): SessionData {
  if (typeof window === "undefined") return defaultSession;
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    return stored ? JSON.parse(stored) : defaultSession;
  } catch {
    return defaultSession;
  }
}

export function setSession(session: SessionData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
}

// Auth mutation hooks
export function useLogout() {
  return useMutation({
    mutationFn: async ({ redirectTo = "/" }: { redirectTo?: string } = {}) => {
      clearSession();
      redirect({ to: getSafeRedirect(redirectTo) });
    },
  });
}

export function useAuthenticate() {
  return useMutation({
    mutationFn: async (
      data:
        | {
            email: string;
            password?: string;
            redirectTo?: string;
          }
        | {
            code: string;
            redirectTo?: string;
          }
    ) => {
      const client = createBrowserClient();
      const redirectTo = data.redirectTo || "/";

      if ("email" in data && !data.password) {
        const { error, isDefined } = await safe(
          client.auth.magicLink.create({ email: data.email })
        );
        if (isDefined) {
          return {
            magicLink: false,
            error: error.message,
          };
        }
        if (error) {
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

      const {
        error,
        isDefined,
        data: authData,
      } = await safe(
        "code" in data
          ? client.auth.login({
              code: data.code,
            })
          : client.auth.login({
              email: data.email,
              password: data.password!,
            })
      );

      if (isDefined) {
        return {
          magicLink: false,
          error: error.message,
        };
      }
      if (error) {
        return {
          magicLink: false,
          error: "Internal server error.",
        };
      }

      setSession({
        user: authData.user,
        accessToken: authData.accessToken ?? null,
        ts: new Date().getTime(),
      });

      if (!authData.user.verified) {
        redirect({ to: "/verify" });
      } else {
        redirect({ to: getSafeRedirect(redirectTo) });
      }

      return { magicLink: false, error: null };
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: async (data: {
      email: string;
      password: string;
      username: string;
      redirectTo?: string;
    }) => {
      const client = createBrowserClient();

      const {
        error,
        isDefined,
        data: authData,
      } = await safe(
        client.auth.register({
          email: data.email,
          password: data.password,
          username: data.username,
        })
      );

      if (isDefined) {
        return { ok: false, error: error.message };
      }
      if (error) {
        return { ok: false, error: "Internal server error." };
      }

      setSession({
        user: authData.user,
        accessToken: authData.accessToken ?? null,
        ts: new Date().getTime(),
      });

      redirect({ to: "/verify" });
      return { ok: true, error: null };
    },
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: async () => {
      const session = getSession();
      const client = createBrowserClient({ accessToken: session.accessToken! });

      const { isDefined, error } = await safe(
        client.email.resendVerification()
      );

      if (isDefined && error.name === "CONFLICT") {
        return { ok: true, alreadyVerified: true };
      }
      if (error) {
        return { ok: false, error: "Internal server error." };
      }

      return { ok: true };
    },
  });
}

export function usePasswordReset() {
  return useMutation({
    mutationFn: async (data: { email: string }) => {
      const client = createBrowserClient();

      const { error, isDefined } = await safe(
        client.auth.passwordReset.create({ email: data.email })
      );

      if (isDefined) {
        return { ok: false, error: error.message };
      }
      if (error) {
        return { ok: false, error: "Internal server error." };
      }

      return { ok: true };
    },
  });
}

export function usePasswordResetConfirm() {
  return useMutation({
    mutationFn: async (data: { token: string; password: string }) => {
      const client = createBrowserClient();

      const {
        error,
        isDefined,
        data: authData,
      } = await safe(
        client.auth.passwordReset.confirm({
          token: data.token,
          password: data.password,
        })
      );

      if (isDefined) {
        return { ok: false, error: error.message };
      }
      if (error) {
        return { ok: false, error: "Internal server error." };
      }

      setSession({
        user: authData.user,
        accessToken: authData.accessToken ?? null,
        ts: new Date().getTime(),
      });

      return { ok: true };
    },
  });
}

export function useUpdateSession() {
  return useMutation({
    mutationFn: async () => {
      const session = getSession();
      const client = createBrowserClient({ accessToken: session.accessToken! });

      const user = await client.users.details({ user: "me" });

      const updatedSession = {
        user: user,
        accessToken: session.accessToken,
        ts: new Date().getTime(),
      };

      setSession(updatedSession);
      return updatedSession;
    },
  });
}

// Legacy exports for easier migration - these will use the hooks internally
export const logout = async (data: { redirectTo?: string } = {}) => {
  clearSession();
  redirect({ to: getSafeRedirect(data.redirectTo || "/") });
};

export const authenticate = async (data: any) => {
  // This is now handled by useAuthenticate hook
  console.warn("authenticate() should be replaced with useAuthenticate() hook");
  throw new Error("Use useAuthenticate() hook instead");
};

export const register = async (data: any) => {
  // This is now handled by useRegister hook
  console.warn("register() should be replaced with useRegister() hook");
  throw new Error("Use useRegister() hook instead");
};

export const resendVerification = async () => {
  // This is now handled by useResendVerification hook
  console.warn(
    "resendVerification() should be replaced with useResendVerification() hook"
  );
  throw new Error("Use useResendVerification() hook instead");
};

export const passwordReset = async (data: any) => {
  // This is now handled by usePasswordReset hook
  console.warn(
    "passwordReset() should be replaced with usePasswordReset() hook"
  );
  throw new Error("Use usePasswordReset() hook instead");
};

export const passwordResetConfirm = async (data: any) => {
  // This is now handled by usePasswordResetConfirm hook
  console.warn(
    "passwordResetConfirm() should be replaced with usePasswordResetConfirm() hook"
  );
  throw new Error("Use usePasswordResetConfirm() hook instead");
};

export const updateSession = async () => {
  // This is now handled by useUpdateSession hook
  console.warn(
    "updateSession() should be replaced with useUpdateSession() hook"
  );
  throw new Error("Use useUpdateSession() hook instead");
};
