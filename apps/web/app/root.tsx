import FontStyles from "@fontsource/raleway/index.css";
import { sentryLink } from "@peated/server/src/lib/trpc";
import type { User } from "@peated/server/types";
import glyphUrl from "@peated/web/assets/glyph.png";
import logo192Url from "@peated/web/assets/logo192.png";
import ErrorPage from "@peated/web/components/error-page";
import { AuthProvider } from "@peated/web/hooks/useAuth";
import { OnlineStatusProvider } from "@peated/web/hooks/useOnlineStatus";
import stylesheetUrl from "@peated/web/styles/index.css";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { cssBundleHref } from "@remix-run/css-bundle";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
} from "@remix-run/react";
import * as Sentry from "@sentry/remix";
import { withSentry } from "@sentry/remix";
import {
  Hydrate,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import type { ComponentProps, PropsWithChildren } from "react";
import { useState } from "react";
import { useDehydratedState } from "use-dehydrated-state";
import LoadingIndicator from "./components/loadingIndicator";
import { default as config } from "./config";
import { ApiProvider } from "./hooks/useApi";
import { ApiUnauthorized } from "./lib/api";
import { logError } from "./lib/log";
import { trpc } from "./lib/trpc";

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

export async function loader({ context }: LoaderFunctionArgs) {
  return json({
    accessToken: context.accessToken,
    user: context.user,
    config,
  });
}

type LoaderData = {
  sentryTrace?: string;
  sentryBaggage?: string;
  accessToken: string;
  user: User | null;
  config: typeof config;
};

export default withSentry(function App() {
  const { accessToken, user, config, ...data } = useLoaderData<LoaderData>();

  if (user) {
    Sentry.setUser({
      id: `${user?.id}`,
      username: user?.username,
      email: user?.email,
    });
  } else {
    Sentry.setUser(null);
  }

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            networkMode: "offlineFirst",
            // suspense: true,
            retry: false,
            // cacheTime: 0,
          },
        },
      }),
  );

  const dehydratedState = useDehydratedState();

  return (
    <Document config={config} data={data} accessToken={accessToken}>
      <GoogleOAuthProvider clientId={config.GOOGLE_CLIENT_ID}>
        <TRPCProvider
          queryClient={queryClient}
          accessToken={accessToken}
          key={accessToken}
        >
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
        </TRPCProvider>
      </GoogleOAuthProvider>
    </Document>
  );
});

function TRPCProvider({
  accessToken,
  ...props
}: { accessToken?: string } & Omit<
  ComponentProps<typeof trpc.Provider>,
  "client"
>) {
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        sentryLink(Sentry.captureException),
        httpBatchLink({
          url: `${config.API_SERVER}/trpc`,
          async headers() {
            return {
              authorization: accessToken ? `Bearer ${accessToken}` : "",
            };
          },
        }),
      ],
    }),
  );
  return <trpc.Provider client={trpcClient} {...props} />;
}

export function ErrorBoundary() {
  const error = useRouteError();
  if (!isRouteErrorResponse(error)) logError(error);

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

function Document({
  children,
  title,
  config,
  data,
  accessToken,
}: PropsWithChildren<{
  title?: string;
  config?: Record<string, any>;
  data?: Record<string, any>;
  accessToken?: string;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1.0, user-scalable=0"
        />
        <meta charSet="utf-8" />
        <Meta />
        {config && (
          <>
            <meta name="description" content={config.DESCRIPTION} />
            <meta name="twitter:description" content={config.DESCRIPTION} />
            <meta name="msapplication-TileColor" content={config.THEME_COLOR} />
            <meta name="theme-color" content={config.THEME_COLOR} />
            <meta name="og:site_name" content="Peated" />
          </>
        )}
        {data?.sentryTrace && (
          <meta name="sentry-trace" content={data.sentryTrace} />
        )}
        {data?.sentryBaggage && (
          <meta name="baggage" content={data.sentryBaggage} />
        )}
        {title ? <title>{title}</title> : <title>Peated</title>}
        <Links />
        {config?.FATHOM_SITE_ID && (
          <script
            src="https://cdn.usefathom.com/script.js"
            data-site={config.FATHOM_SITE_ID}
            defer
          ></script>
        )}
      </head>
      <body className="h-full">
        <LoadingIndicator />

        {children}
        <ScrollRestoration />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.CONFIG = ${JSON.stringify(config || {})};`,
          }}
        />
        {!!accessToken && (
          <script
            dangerouslySetInnerHTML={{
              __html: `window.ACCESS_TOKEN = ${JSON.stringify(
                accessToken || null,
              )};`,
            }}
          />
        )}
        <Scripts />
        {/* <LiveReload /> */}
      </body>
    </html>
  );
}
