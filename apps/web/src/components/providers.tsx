import type { User } from "@peated/server/types";
import FlashMessages from "@peated/web/components/flash";
import { default as config } from "@peated/web/config";
import { AuthProvider } from "@peated/web/hooks/useAuth";
import { OnlineStatusProvider } from "@peated/web/hooks/useOnlineStatus";
import { updateSession } from "@peated/web/lib/auth.actions";
import ORPCProvider from "@peated/web/lib/orpc/provider";
import type { SessionData } from "@peated/web/lib/session.server";
import { GoogleOAuthProvider } from "@react-oauth/google";
import * as Sentry from "@sentry/react";
import { ReactQueryStreamedHydration } from "@tanstack/react-query-next-experimental";
import { useState } from "react";
import { useInterval } from "usehooks-ts";

export default function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session: SessionData;
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

  useInterval(async () => {
    if (accessToken) {
      const sessionData = await updateSession();
      // Note: In a real app, you might want to update the session context here
      setUser(sessionData.user);
      setAccessToken(sessionData.accessToken);
    }
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
