"use client";

import { useHydrated } from "@peated/web/components/clientOnly";
import { default as config } from "@peated/web/config";
import { ApiProvider } from "@peated/web/hooks/useApi";
import { AuthProvider } from "@peated/web/hooks/useAuth";
import { OnlineStatusProvider } from "@peated/web/hooks/useOnlineStatus";
import useSingletonQueryClient from "@peated/web/hooks/useSingletonQueryClient";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { setUser } from "@sentry/nextjs";
import { QueryClientProvider } from "@tanstack/react-query";
import { type SessionData } from "../../lib/session.server";
import TRPCProvider from "./trpc";

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

  const hydrated = useHydrated();
  const queryClient = useSingletonQueryClient({ ssr: !hydrated });

  return (
    <GoogleOAuthProvider clientId={config.GOOGLE_CLIENT_ID}>
      <TRPCProvider
        queryClient={queryClient}
        accessToken={accessToken}
        key={accessToken}
      >
        <QueryClientProvider client={queryClient}>
          <OnlineStatusProvider>
            <AuthProvider user={user}>
              <ApiProvider accessToken={accessToken} server={config.API_SERVER}>
                {children}
              </ApiProvider>
            </AuthProvider>
          </OnlineStatusProvider>
        </QueryClientProvider>
      </TRPCProvider>
    </GoogleOAuthProvider>
  );
}
