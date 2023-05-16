import { GoogleOAuthProvider } from "@react-oauth/google";
import * as Sentry from "@sentry/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import {
  RouterProvider,
  createBrowserRouter,
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from "react-router-dom";

// import * as serviceWorkerRegistration from "./serviceWorkerRegistration";
import Spinner from "./components/spinner";
import config from "./config";
import { AuthProvider } from "./hooks/useAuth";
import { OnlineStatusProvider } from "./hooks/useOnlineStatus";
import createRoutes from "./routes";

Sentry.init({
  dsn: config.SENTRY_DSN,
  release: config.VERSION,
  debug: config.DEBUG,

  integrations: [
    new Sentry.BrowserTracing({
      tracePropagationTargets: ["localhost", /^\//, "api.peated.app"],
      routingInstrumentation: Sentry.reactRouterV6Instrumentation(
        React.useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      ),
    }),
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // We recommend adjusting this value in production, or using tracesSampler
  // for finer control
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,
});

const router = Sentry.wrapCreateBrowserRouter(createBrowserRouter)(
  createRoutes(),
);

function initMobileControls() {
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      suspense: true,
    },
  },
});

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);
root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={config.GOOGLE_CLIENT_ID}>
      <QueryClientProvider client={queryClient}>
        <OnlineStatusProvider>
          <AuthProvider>
            <Suspense
              fallback={
                <div className="flex h-screen items-center justify-center">
                  <Spinner />
                </div>
              }
            >
              <RouterProvider router={router} />
            </Suspense>
          </AuthProvider>
        </OnlineStatusProvider>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>,
);
