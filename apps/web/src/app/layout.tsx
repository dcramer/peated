import "@fontsource/raleway/index.css";
import Fathom from "@peated/web/components/fathom";
import config from "@peated/web/config";
import { defaultSession } from "@peated/web/lib/session.server";
import "@peated/web/styles/index.css";
import * as Sentry from "@sentry/nextjs";
import type { Metadata, Viewport } from "next";
import React from "react";
import Providers from "./providers/providers";

export const dynamic = "force-dynamic";

export const fetchCache = "default-no-store";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1.0,
  userScalable: false,
  themeColor: config.THEME_COLOR,
};

export function generateMetadata(): Metadata {
  return {
    title: {
      template: "%s | Peated",
      default: "Peated",
    },
    openGraph: {
      siteName: "Peated",
    },
    description: config.DESCRIPTION,
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
  return (
    <html lang="en">
      <body className="h-full">
        <Providers
          session={{
            user: defaultSession.user,
            accessToken: defaultSession.accessToken,
            ts: defaultSession.ts,
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
