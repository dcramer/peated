import "@fontsource/raleway/index.css";
import Fathom from "@peated/web/components/fathom";
import config from "@peated/web/config";
import { getSession } from "@peated/web/lib/session.server";
import "@peated/web/styles/index.css";
import type { Metadata, Viewport } from "next";
import React from "react";
import Providers from "./providers/providers";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1.0,
  userScalable: false,
  themeColor: config.THEME_COLOR,
};

export const metadata: Metadata = {
  title: "Peated",
  description: config.DESCRIPTION,
};

export default async function RootLayout({
  children,
  // auth,
}: Readonly<{
  children: React.ReactNode;
  // auth: React.ReactNode;
}>) {
  const session = await getSession();

  return (
    <html lang="en">
      <body className="h-full">
        <Providers
          session={{
            user: session.user,
            accessToken: session.accessToken,
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
