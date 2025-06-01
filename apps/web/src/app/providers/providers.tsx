"use client";

import FlashMessages from "@peated/web/components/flash";
import { default as config } from "@peated/web/config";
import { AuthProvider } from "@peated/web/hooks/useAuth";
import { OnlineStatusProvider } from "@peated/web/hooks/useOnlineStatus";
import { ensureSessionSynced } from "@peated/web/lib/auth.actions";
import ORPCProvider from "@peated/web/lib/orpc/provider";
import type { SessionData } from "@peated/web/lib/session.server";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { setUser } from "@sentry/nextjs";
import { ReactQueryStreamedHydration } from "@tanstack/react-query-next-experimental";
import { useInterval } from "usehooks-ts";

export default function Providers({
  children,
  session: { user, accessToken },
}: {
  children: React.ReactNode;
  session: SessionData;
}) {
  setUser(
    user
      ? {
          id: `${user?.id}`,
          username: user?.username,
          email: user?.email,
        }
      : null
  );

  useInterval(async () => {
    ({ user, accessToken } = await ensureSessionSynced());
  }, 60000);

  return (
    <GoogleOAuthProvider clientId={config.GOOGLE_CLIENT_ID}>
      <ORPCProvider
        apiServer={config.API_SERVER}
        accessToken={accessToken}
        key={accessToken}
      >
        <ReactQueryStreamedHydration>
          <OnlineStatusProvider>
            <AuthProvider user={user}>
              <FlashMessages>{children}</FlashMessages>
            </AuthProvider>
          </OnlineStatusProvider>
        </ReactQueryStreamedHydration>
      </ORPCProvider>
    </GoogleOAuthProvider>
  );
}
