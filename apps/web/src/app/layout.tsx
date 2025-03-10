import "@fontsource/raleway/index.css";
import Fathom from "@peated/web/components/fathom";
import config from "@peated/web/config";
import { getSession } from "@peated/web/lib/session.server";
import "@peated/web/styles/index.css";
import { setUser } from "@sentry/nextjs";
import type { Metadata, Viewport } from "next";
import React from "react";
import Providers from "./providers/providers";

// default behavior is to disable cache, as it breaks quite a few flows
// which are fairly dynamic (e.g. add tasting, add bottle, etc)

export const fetchCache = "default-no-store";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1.0,
  userScalable: false,
  themeColor: config.THEME_COLOR,
};

export const metadata: Metadata = {
  title: {
    template: "%s | Peated",
    default: "Peated",
  },
  openGraph: {
    siteName: "Peated",
  },
  description: config.DESCRIPTION,
};

export default async function RootLayout({
  children,
  // auth,
}: Readonly<{
  children: React.ReactNode;
  // auth: React.ReactNode;
}>) {
  let session = await getSession();

  // we need to bind the user on the server, but we also do this in providers
  // so it stays updated on the client appropriately
  setUser(
    session.user
      ? {
          id: `${session.user.id}`,
          username: session.user.username,
          email: session.user.email,
        }
      : null,
  );

  return (
    <html lang="en">
      <body className="h-full">
        <Providers
          session={{
            user: session.user,
            accessToken: session.accessToken,
            ts: session.ts,
          }}
        >
          {children}

          {config.FATHOM_SITE_ID && (
            <Fathom
              siteId={config.FATHOM_SITE_ID}
              includedDomains={["peated.com"]}
            />
          )}
        </Providers>
      </body>
    </html>
  );
}
