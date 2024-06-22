import "@fontsource/raleway/index.css";
import "@peated/web/styles/index.css";
import type { Metadata, Viewport } from "next";
import Fathom from "../components/Fathom";
import config from "../config";
// import "./globals.css";
import React from "react";
import Layout from "../components/layout";
import { getSession } from "../lib/session.server";
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
  sidebar,
  ...props
}: Readonly<{
  children: React.ReactNode;
  sidebar: React.ReactNode;
}>) {
  console.log({ sidebar, props });

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
          <Layout rightSidebar={sidebar}>{children}</Layout>

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
