"use client";

import FlashMessages from "@peated/web/components/flash";
import { default as config } from "@peated/web/config";
import { ApiProvider } from "@peated/web/hooks/useApi";
import { AuthProvider } from "@peated/web/hooks/useAuth";
import { OnlineStatusProvider } from "@peated/web/hooks/useOnlineStatus";
import { TRPCProvider } from "@peated/web/lib/trpc";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { setUser } from "@sentry/nextjs";
import { ReactQueryStreamedHydration } from "@tanstack/react-query-next-experimental";
import { type SessionData } from "../../lib/session.server";

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
      : null,
  );

  return (
    <GoogleOAuthProvider clientId={config.GOOGLE_CLIENT_ID}>
      <TRPCProvider
        apiServer={config.API_SERVER}
        accessToken={accessToken}
        key={accessToken}
      >
        <ReactQueryStreamedHydration>
          <OnlineStatusProvider>
            <AuthProvider user={user}>
              <ApiProvider accessToken={accessToken} server={config.API_SERVER}>
                <FlashMessages>{children}</FlashMessages>
              </ApiProvider>
            </AuthProvider>
          </OnlineStatusProvider>
        </ReactQueryStreamedHydration>
      </TRPCProvider>
    </GoogleOAuthProvider>
  );
}
