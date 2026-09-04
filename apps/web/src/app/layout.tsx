import "@fontsource-variable/karla";
import "@fontsource-variable/space-grotesk";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import Fathom from "@peated/web/components/fathom";
import config from "@peated/web/config";
import { getSession } from "@peated/web/lib/session.server";
import { foundationStyles } from "@peated/web/styles/foundations.stylex";
import "@peated/web/styles/index.css";
import * as Sentry from "@sentry/nextjs";
import * as stylex from "@stylexjs/stylex";
import type { Metadata, Viewport } from "next";
import React from "react";
import Providers from "./providers/providers";

export const dynamic = "force-dynamic";

export const fetchCache = "default-no-store";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    {
      color: config.THEME_COLOR_LIGHT,
      media: "(prefers-color-scheme: light)",
    },
    {
      color: config.THEME_COLOR_DARK,
      media: "(prefers-color-scheme: dark)",
    },
  ],
};

export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(config.URL_PREFIX),
    applicationName: "Peated",
    appleWebApp: {
      capable: true,
      title: "Peated",
    },
    title: {
      template: "%s | Peated",
      default: "Peated",
    },
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: "Peated",
    },
    twitter: {
      card: "summary",
    },
    description: config.DESCRIPTION,
    icons: {
      apple: [
        {
          url: "/assets/glyph-black.png",
          sizes: "192x192",
          type: "image/png",
        },
      ],
    },
    other: {
      ...Sentry.getTraceData(),
    },
  };
}

export default async function RootLayout({
  children,
  // auth,
}: Readonly<{
  children: React.ReactNode;
  // auth: React.ReactNode;
}>) {
  const session = await getSession();

  // we need to bind the user on the server, but we also do this in providers
  // so it stays updated on the client appropriately
  Sentry.setUser(
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
      <body {...stylex.props(foundationStyles.document)}>
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
