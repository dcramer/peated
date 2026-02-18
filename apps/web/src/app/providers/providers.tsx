"use client";

import FlashMessages from "@peated/web/components/flash";
import { default as config } from "@peated/web/config";
import { AuthProvider } from "@peated/web/hooks/useAuth";
import { OnlineStatusProvider } from "@peated/web/hooks/useOnlineStatus";
import { ensureSessionSynced } from "@peated/web/lib/auth.actions";
import ORPCProvider from "@peated/web/lib/orpc/provider";
import { type SessionData } from "@peated/web/lib/session.server";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { setUser } from "@sentry/nextjs";
import { ReactQueryStreamedHydration } from "@tanstack/react-query-next-experimental";
import { useEffect, useState } from "react";
import { useInterval } from "usehooks-ts";

export default function Providers({
  children,
  session: initialSession,
}: {
  children: React.ReactNode;
  session: SessionData;
}) {
  const [session, setSession] = useState<SessionData>(initialSession);

  // Sync from server props on navigation (accessToken is a stable identity)
  useEffect(() => {
    setSession(initialSession);
  }, [initialSession.accessToken]);

  // Periodic session refresh
  useInterval(async () => {
    const updated = await ensureSessionSynced();
    setSession(updated);
  }, 60000);

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
        key={session.accessToken}
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
