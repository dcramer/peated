import type { User } from "@peated/server/types";
import FlashMessages from "@peated/web/components/flash";
import { default as config } from "@peated/web/config";
import { AuthProvider } from "@peated/web/hooks/useAuth";
import { OnlineStatusProvider } from "@peated/web/hooks/useOnlineStatus";
import ORPCProvider from "@peated/web/lib/orpc/provider";
import type { SessionData } from "@peated/web/lib/session.server";
import { GoogleOAuthProvider } from "@react-oauth/google";
import * as Sentry from "@sentry/react";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import type React from "react";
import { useState } from "react";

export default function Providers({
  children,
  session,
  queryClient,
}: {
  children: React.ReactNode;
  session: SessionData;
  queryClient: QueryClient;
}) {
  const [user, setUser] = useState<User | null>(session.user);
  const [accessToken, setAccessToken] = useState<string | null>(
    session.accessToken
  );

  Sentry.setUser(
    user
      ? {
          id: `${user?.id}`,
          username: user?.username,
          email: user?.email,
        }
      : null
  );

  return (
    <QueryClientProvider client={queryClient}>
      <GoogleOAuthProvider clientId={config.GOOGLE_CLIENT_ID}>
        <ORPCProvider
          apiServer={config.API_SERVER}
          accessToken={accessToken}
          key={accessToken}
        >
          <OnlineStatusProvider>
            <AuthProvider user={user}>
              <FlashMessages>{children}</FlashMessages>
            </AuthProvider>
          </OnlineStatusProvider>
        </ORPCProvider>
      </GoogleOAuthProvider>
    </QueryClientProvider>
  );
}
