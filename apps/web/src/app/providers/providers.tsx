"use client";

import FlashMessages from "@peated/web/components/flash";
import { default as config } from "@peated/web/config";
import { AuthProvider } from "@peated/web/hooks/useAuth";
import { OnlineStatusProvider } from "@peated/web/hooks/useOnlineStatus";
import { getAuthRedirect } from "@peated/web/lib/auth";
import {
  ensureSessionSynced,
  updateSession,
} from "@peated/web/lib/auth.actions";
import ORPCProvider from "@peated/web/lib/orpc/provider";
import { type SessionData } from "@peated/web/lib/session.server";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { setUser } from "@sentry/nextjs";
import { ReactQueryStreamedHydration } from "@tanstack/react-query-next-experimental";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useInterval } from "usehooks-ts";

export default function Providers({
  children,
  session: initialSession,
}: {
  children: React.ReactNode;
  session: SessionData;
}) {
  const [session, setSession] = useState<SessionData>(initialSession);
  const unauthorizedHandlingRef = useRef<Promise<boolean> | null>(null);
  const router = useRouter();

  // Sync from server props on navigation
  useEffect(() => {
    setSession(initialSession);
  }, [initialSession.accessToken, initialSession.ts]);

  // Periodic session refresh
  useInterval(async () => {
    try {
      const updated = await ensureSessionSynced();
      setSession(updated);
    } catch {
      // Transient errors: preserve current session state
    }
  }, 60000);

  const handleUnauthorized = useCallback(async () => {
    if (unauthorizedHandlingRef.current) return unauthorizedHandlingRef.current;

    const handled = (async () => {
      try {
        const updated = await updateSession();

        if (updated.user && updated.accessToken) {
          setSession(updated);
          return false;
        }
      } catch {
        // Preserve the original 401 handling when session validation itself fails.
        return false;
      }

      const currentUrl = new URL(window.location.href);
      router.push(
        getAuthRedirect({
          pathname: currentUrl.pathname,
          searchParams: currentUrl.search ? currentUrl.searchParams : undefined,
        }),
      );
      return true;
    })();

    unauthorizedHandlingRef.current = handled;

    try {
      return await handled;
    } finally {
      unauthorizedHandlingRef.current = null;
    }
  }, [router]);

  setUser(
    session.user
      ? {
          id: `${session.user.id}`,
          username: session.user.username,
          email: session.user.email,
        }
      : null,
  );

  return (
    <GoogleOAuthProvider clientId={config.GOOGLE_CLIENT_ID}>
      <ORPCProvider
        apiServer={config.API_SERVER}
        accessToken={session.accessToken}
        onUnauthorized={handleUnauthorized}
      >
        <ReactQueryStreamedHydration>
          <OnlineStatusProvider>
            <AuthProvider user={session.user}>
              <FlashMessages>{children}</FlashMessages>
            </AuthProvider>
          </OnlineStatusProvider>
        </ReactQueryStreamedHydration>
      </ORPCProvider>
    </GoogleOAuthProvider>
  );
}
