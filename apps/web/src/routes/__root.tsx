import "@fontsource/raleway/index.css";
import Fathom from "@peated/web/components/fathom";
import config from "@peated/web/config";
import "@peated/web/styles/index.css";
import type { RouterUtils } from "@orpc/react-query";
import type { RouterClient } from "@orpc/server";
import type { Router } from "@peated/server/orpc/router";
import * as Sentry from "@sentry/react";
import type { QueryClient } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import React from "react";
import Providers from "../components/providers";
import type { ClientContext } from "../lib/orpc/client";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  orpc: RouterUtils<RouterClient<Router, ClientContext>>;
  orpcClient: RouterClient<Router, ClientContext>;
}>()({
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

  // Set Sentry user context
  React.useEffect(() => {
    Sentry.setUser(
      session.user
        ? {
            id: `${session.user.id}`,
            username: session.user.username,
            email: session.user.email,
          }
        : null
    );
  }, [session.user]);

  return (
    <div className="h-full">
      <Providers session={session}>
        <Outlet />

        {config.FATHOM_SITE_ID && (
          <Fathom
            siteId={config.FATHOM_SITE_ID}
            includedDomains={["peated.com"]}
          />
        )}
      </Providers>
    </div>
  );
}
