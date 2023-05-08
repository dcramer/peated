import React from "react";
import ReactDOM from "react-dom/client";
import {
  createBrowserRouter,
  createRoutesFromChildren,
  matchRoutes,
  RouterProvider,
  useLocation,
  useNavigationType,
} from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import * as Sentry from "@sentry/react";

// import * as serviceWorkerRegistration from "./serviceWorkerRegistration";
import createRoutes from "./routes";
import config from "./config";
import { AuthProvider } from "./hooks/useAuth";
import { OnlineStatusProvider } from "./hooks/useOnlineStatus";
import { register } from "./serviceWorkerRegistration";

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
        matchRoutes
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
  createRoutes()
);

function initMobileControls() {
  // https://stackoverflow.com/questions/37808180/disable-viewport-zooming-ios-10-safari
  document.addEventListener(
    "touchmove",
    function (event) {
      // @ts-ignore-next-line
      if (event.scale !== 1) {
        event.preventDefault();
      }
    },
    false
  );

  var lastTouchEnd = 0;
  document.addEventListener(
    "touchend",
    function (event) {
      var now = new Date().getTime();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    },
    false
  );
}

initMobileControls();

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);
root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={config.GOOGLE_CLIENT_ID}>
      <OnlineStatusProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </OnlineStatusProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://cra.link/PWA
register();
