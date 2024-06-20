"use client";

import { useHydrated } from "@peated/web-next/components/clientOnly";
import { default as config } from "@peated/web-next/config";
import { ApiProvider } from "@peated/web-next/hooks/useApi";
import { AuthProvider } from "@peated/web-next/hooks/useAuth";
import { OnlineStatusProvider } from "@peated/web-next/hooks/useOnlineStatus";
import useSingletonQueryClient from "@peated/web-next/hooks/useSingletonQueryClient";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { QueryClientProvider } from "@tanstack/react-query";
import { type SessionData } from "../../lib/auth";
import TRPCProvider from "./trpc";

export default function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session: SessionData;
}) {
  // if (user) {
  //   Sentry.setUser({
  //     id: `${user?.id}`,
  //     username: user?.username,
  //     email: user?.email,
  //   });
  // } else {
  //   Sentry.setUser(null);
  // }

  const hydrated = useHydrated();
  const queryClient = useSingletonQueryClient({ ssr: !hydrated });

  // const dehydratedState = useDehydratedState();

  return (
    <GoogleOAuthProvider clientId={config.GOOGLE_CLIENT_ID}>
      <TRPCProvider
        queryClient={queryClient}
        accessToken={session.accessToken}
        key={session.accessToken}
      >
        <QueryClientProvider client={queryClient}>
          <OnlineStatusProvider>
            <AuthProvider user={session.user}>
              <ApiProvider
                accessToken={session.accessToken}
                server={config.API_SERVER}
              >
                {children}
              </ApiProvider>
            </AuthProvider>
          </OnlineStatusProvider>
        </QueryClientProvider>
      </TRPCProvider>
    </GoogleOAuthProvider>
  );
}
