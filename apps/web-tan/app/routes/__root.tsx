import "@fontsource/raleway/index.css";
import { type User } from "@peated/server/types";
import config from "@peated/web/config";
import "@peated/web/styles/index.css";
import { setUser } from "@sentry/browser";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

// Import providers and other components
import FlashMessages from "@peated/web/components/flash";
import { ApiProvider } from "@peated/web/hooks/useApi";
import { AuthProvider } from "@peated/web/hooks/useAuth";
import { OnlineStatusProvider } from "@peated/web/hooks/useOnlineStatus";
import TRPCProvider from "@peated/web/lib/trpc/provider";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Fathom from "../components/Fathom";

// Session type definition
interface SessionData {
  user: User | null;
  accessToken: string | null;
  ts: number | null;
}

// Providers component
function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session: SessionData;
}) {
  const { user, accessToken } = session;

  // Create a new QueryClient instance
  const [queryClient] = useState(() => new QueryClient());

  setUser(
    user
      ? {
          id: `${user?.id}`,
          username: user?.username,
          email: user?.email,
        }
      : null,
  );

  // Note: Session syncing would need to be implemented differently in TanStack
  // useInterval(() => {
  //   // Implement session syncing logic here
  // }, 60000);

  return (
    <GoogleOAuthProvider clientId={config.GOOGLE_CLIENT_ID}>
      <TRPCProvider
        apiServer={config.API_SERVER}
        accessToken={accessToken}
        key={accessToken}
      >
        <QueryClientProvider client={queryClient}>
          <OnlineStatusProvider>
            <AuthProvider user={user}>
              <ApiProvider accessToken={accessToken} server={config.API_SERVER}>
                <FlashMessages>{children}</FlashMessages>
              </ApiProvider>
            </AuthProvider>
          </OnlineStatusProvider>
        </QueryClientProvider>
      </TRPCProvider>
    </GoogleOAuthProvider>
  );
}

export const Route = createRootRoute({
  head: () => ({
    title: "Peated",
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: `width=device-width, initial-scale=1, maximum-scale=1.0, user-scalable=false`,
      },
      {
        name: "description",
        content: config.DESCRIPTION,
      },
      {
        name: "theme-color",
        content: config.THEME_COLOR,
      },
      {
        property: "og:site_name",
        content: "Peated",
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  // In TanStack Router, we need to handle session client-side
  // This is a simplified version - you'll need to implement actual session fetching
  const [session, setSession] = useState<SessionData>({
    user: null,
    accessToken: null,
    ts: null,
  });

  // Fetch session on mount
  useEffect(() => {
    async function fetchSession() {
      try {
        // Replace this with your actual session fetching logic
        const response = await fetch("/api/session");
        if (response.ok) {
          const sessionData = await response.json();
          setSession(sessionData);
        }
      } catch (error) {
        console.error("Failed to fetch session:", error);
      }
    }

    fetchSession();
  }, []);

  return (
    <RootDocument>
      <Providers session={session}>
        <Outlet />

        {config.FATHOM_SITE_ID && (
          <Fathom
            siteId={config.FATHOM_SITE_ID}
            includedDomains={["peated.com"]}
          />
        )}
      </Providers>
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="h-full">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
