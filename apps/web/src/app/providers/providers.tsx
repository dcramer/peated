"use client";

import { FlashMessages } from "@peated/web/components/flashMessages.stylex";
import { default as config } from "@peated/web/config";
import { AuthProvider } from "@peated/web/hooks/useAuth";
import { OnlineStatusProvider } from "@peated/web/hooks/useOnlineStatus";
import { getAccountStateRedirect } from "@peated/web/lib/auth";
import {
  ensureSessionSynced,
  updateSession,
} from "@peated/web/lib/auth.actions";
import ORPCProvider from "@peated/web/lib/orpc/provider";
import { type SessionData } from "@peated/web/lib/session.server";
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
  const accountStateHandlingRef = useRef<Promise<boolean> | null>(null);
  const router = useRouter();

  // Sync from server props on navigation
  useEffect(() => {
    setSession(initialSession);
  }, [initialSession]);

  // Periodic session refresh
  useInterval(async () => {
    try {
      const updated = await ensureSessionSynced();
      setSession(updated);
    } catch {
      // Transient errors: preserve current session state
    }
  }, 60000);

  // The API said the account changed (token gone, account deleted, or
  // suspended). Refresh the session once for all in-flight requests and
  // route on what comes back.
  const handleAccountStateError = useCallback(async () => {
    if (accountStateHandlingRef.current) return accountStateHandlingRef.current;

    const handled = (async () => {
      let updated: SessionData;
      try {
        updated = await updateSession();
      } catch {
        // Let the original API error surface when the refresh itself fails.
        return false;
      }

      const currentUrl = new URL(window.location.href);
      const destination = getAccountStateRedirect(updated, {
        pathname: currentUrl.pathname,
        searchParams: currentUrl.search ? currentUrl.searchParams : undefined,
      });
      if (!destination) {
        setSession(updated);
        return false;
      }
      router.push(destination);
      return true;
    })();

    accountStateHandlingRef.current = handled;

    try {
      return await handled;
    } finally {
      accountStateHandlingRef.current = null;
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
    <ORPCProvider
      apiServer={config.API_SERVER}
      accessToken={session.accessToken}
      onAccountStateError={handleAccountStateError}
    >
      <ReactQueryStreamedHydration>
        <OnlineStatusProvider>
          <AuthProvider user={session.user}>
            <FlashMessages>{children}</FlashMessages>
          </AuthProvider>
        </OnlineStatusProvider>
      </ReactQueryStreamedHydration>
    </ORPCProvider>
  );
}
