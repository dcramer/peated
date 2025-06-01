import "@fontsource/raleway/index.css";
import Fathom from "@peated/web/components/fathom";
import config from "@peated/web/config";
import {
  type SessionData,
  useAppSession,
} from "@peated/web/lib/session.server";
import "@peated/web/styles/index.css";
import type { RouterUtils } from "@orpc/react-query";
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
import type { ServerClient } from "../lib/orpc/client.server";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  orpc: RouterUtils<ServerClient>;
  orpcClient: ServerClient;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
      },
      { name: "theme-color", content: config.THEME_COLOR },
      { title: "Peated", description: config.DESCRIPTION },
    ],
    links: [{ rel: "icon", href: "/favicon.ico" }],
  }),
  loader: async () => {
    const session = await useAppSession();
    const user = session.data.user;

    // Bind the user on the server for Sentry
    Sentry.setUser(
      user
        ? {
            id: `${user.id}`,
            username: user.username,
            email: user.email,
          }
        : null
    );

    return {
      session: {
        user: user,
        accessToken: session.data.accessToken,
        ts: session.data.ts,
      },
    };
  },
  component: RootComponent,
});

function RootComponent() {
  const { session } = Route.useLoaderData();

  return <RootDocument session={session} />;
}

function RootDocument({
  session,
}: {
  session: SessionData;
}) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="h-full">
        <Providers session={session}>
          <Outlet />

          {config.FATHOM_SITE_ID && (
            <Fathom
              siteId={config.FATHOM_SITE_ID}
              includedDomains={["peated.com"]}
            />
          )}

          <Scripts />
        </Providers>
      </body>
    </html>
  );
}
