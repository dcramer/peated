import "@fontsource/raleway/index.css";
import Fathom from "@peated/web/components/fathom";
import config from "@peated/web/config";
import "@peated/web/styles/index.css";
import type { RouterUtils } from "@orpc/react-query";
import type { RouterClient } from "@orpc/server";
import type { Router } from "@peated/server/orpc/router";
import * as Sentry from "@sentry/react";
import type { QueryClient } from "@tanstack/react-query";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import React from "react";
import Providers from "../components/providers";
import type { ClientContext } from "../lib/orpc/client";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  orpc: RouterUtils<RouterClient<Router, ClientContext>>;
  orpcClient: RouterClient<Router, ClientContext>;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      { title: "Peated" },
    ],
  }),
  loader: async () => {
    // For now, return empty session data
    // TODO: Implement proper session loading from localStorage/API
    return {
      session: {
        user: null,
        accessToken: null,
        ts: null,
      },
    };
  },
  component: RootComponent,
});

function RootComponent() {
  const { session } = Route.useLoaderData();
  const { queryClient } = Route.useRouteContext();

  // Set Sentry user context
  React.useEffect(() => {
    if (session.user) {
      Sentry.setUser({
        id: `${session.user.id}`,
        username: session.user.username,
        email: session.user.email,
      });
    } else {
      Sentry.setUser(null);
    }
  }, [session.user]);

  return (
    <RootDocument>
      <Providers session={session} queryClient={queryClient}>
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

function RootDocument({ children }: { children: React.ReactNode }) {
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
