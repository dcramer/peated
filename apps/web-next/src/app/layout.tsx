import type { Metadata } from "next";
import Fathom from "../components/Fathom";
import config from "../config";
import "./globals.css";
import { getSession } from "./login/actions";
import Providers from "./providers/providers";

export const metadata: Metadata = {
  title: "Peated",
  description: config.DESCRIPTION,
  viewport:
    "width=device-width, initial-scale=1, maximum-scale=1.0, user-scalable=0",
  themeColor: config.THEME_COLOR,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
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
