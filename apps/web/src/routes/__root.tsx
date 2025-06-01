import "@fontsource/raleway/index.css";
import Fathom from "@peated/web/components/fathom";
import config from "@peated/web/config";
import { getSession } from "@peated/web/lib/session.server";
import "@peated/web/styles/index.css";
import * as Sentry from "@sentry/react";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import React from "react";
import Providers from "../app/providers/providers";

export const Route = createRootRoute({
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
    const session = await getSession();

    // Bind the user on the server for Sentry
    Sentry.setUser(
      session.user
        ? {
            id: `${session.user.id}`,
            username: session.user.username,
            email: session.user.email,
          }
        : null
    );

    return {
      session: {
        user: session.user,
        accessToken: session.accessToken,
        ts: session.ts,
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
  session: {
    user: any;
    accessToken: string;
    ts: number;
  };
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
