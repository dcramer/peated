import FontStyles from "@fontsource/raleway/index.css";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { cssBundleHref } from "@remix-run/css-bundle";
import type {
  LinksFunction,
  LoaderArgs,
  V2_MetaFunction,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useRouteError,
} from "@remix-run/react";
import { withSentry } from "@sentry/remix";
import {
  Hydrate,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { useState } from "react";
import { useDehydratedState } from "use-dehydrated-state";

import glyphUrl from "~/assets/glyph.png";
import logo192Url from "~/assets/logo192.png";
import ErrorPage from "~/components/error-page";
import { AuthProvider } from "~/hooks/useAuth";
import { OnlineStatusProvider } from "~/hooks/useOnlineStatus";
import stylesheetUrl from "~/styles/index.css";
import LoadingIndicator from "./components/loadingIndicator";
import { default as config } from "./config";
import { ApiProvider } from "./hooks/useApi";
import { ApiUnauthorized } from "./lib/api";
import { authMiddleware } from "./services/auth.server";
import { getAccessToken, getSession, getUser } from "./services/session.server";

function initMobileControls() {
  if (typeof document === "undefined") return;

  if (document === undefined) return;
  type CSSStyleDeclrationWithZoom = CSSStyleDeclaration & {
    zoom: number;
  };
  document.addEventListener("gesturestart", function (e) {
    e.preventDefault();
    (document.body.style as CSSStyleDeclrationWithZoom).zoom = 0.99;
  });

  document.addEventListener("gesturechange", function (e) {
    e.preventDefault();
    (document.body.style as CSSStyleDeclrationWithZoom).zoom = 0.99;
  });
  document.addEventListener("gestureend", function (e) {
    e.preventDefault();
    (document.body.style as CSSStyleDeclrationWithZoom).zoom = 1;
  });
}

initMobileControls();

function unregisterServiceWorkers() {
  if (typeof navigator === "undefined") return;

  if (window.navigator && navigator.serviceWorker) {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
  }
}

unregisterServiceWorkers();

export const meta: V2_MetaFunction = () => {
  return [
    { name: "description", content: config.DESCRIPTION },
    { name: "twitter:description", content: config.DESCRIPTION },

    { name: "msapplication-TileColor", content: config.THEME_COLOR },
    { name: "theme-color", content: config.THEME_COLOR },
  ];
};

export const links: LinksFunction = () => [
  { rel: "manifest", href: "/resources/manifest.webmanifest" },
  { rel: "stylesheet", href: stylesheetUrl },
  { rel: "icon", type: "image/png", href: glyphUrl },
  {
    rel: "mask-icon",
    type: "image/png",
    href: glyphUrl,
    color: config.THEME_COLOR,
  },
  {
    rel: "apple-touch-icon",
    type: "image/png",
    href: logo192Url,
    color: config.THEME_COLOR,
  },

  { rel: "stylesheet", href: FontStyles },
  ...(cssBundleHref ? [{ rel: "stylesheet", href: cssBundleHref }] : []),
];

function Document({
  children,
  title,
  config,
}: PropsWithChildren<{ title?: string; config?: Record<string, any> }>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1.0, user-scalable=0"
        />
        <meta charSet="utf-8" />
        <Meta />
        {title ? <title>{title}</title> : null}
        <Links />
      </head>
      <body className="h-full">
        <LoadingIndicator />

        {children}
        <ScrollRestoration />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.CONFIG = ${JSON.stringify(config)};`,
          }}
        />
        <Scripts />
        {/* LiveReload causes issues as child loaders will attempt to reload ignoring the behavior of the root loader */}
        {/* <LiveReload /> */}
      </body>
    </html>
  );
}

export async function loader({ request }: LoaderArgs) {
  const intercept = await authMiddleware({ request });
  if (intercept) return intercept;

  const session = await getSession(request);
  const user = await getUser(session);
  const accessToken = await getAccessToken(session);

  return json({
    accessToken,
    user,
    config,
  });
}

export default withSentry(function App() {
  const { accessToken, user, config } = useLoaderData<typeof loader>();

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            suspense: true,
            retry: false,
          },
        },
      }),
  );

  const dehydratedState = useDehydratedState();

  return (
    <Document config={config}>
      <GoogleOAuthProvider clientId={config.GOOGLE_CLIENT_ID}>
        <QueryClientProvider client={queryClient}>
          <Hydrate state={dehydratedState}>
            <OnlineStatusProvider>
              <AuthProvider user={user}>
                <ApiProvider
                  accessToken={accessToken}
                  server={config.API_SERVER}
                >
                  <Outlet />
                </ApiProvider>
              </AuthProvider>
            </OnlineStatusProvider>
          </Hydrate>
        </QueryClientProvider>
      </GoogleOAuthProvider>
    </Document>
  );
});

export function ErrorBoundary() {
  const error = useRouteError();
  console.error(error);

  if (error instanceof ApiUnauthorized && error.data.name === "invalid_token") {
    // need middleware!
    // logout();
    location.href = "/login";
    return null;
  }

  return (
    <Document>
      <ErrorPage />
    </Document>
  );
}
