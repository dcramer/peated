import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
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

  integrations: [
    new Sentry.BrowserTracing(),
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

const router = createBrowserRouter(createRoutes());

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
