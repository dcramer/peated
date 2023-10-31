import { RemixBrowser, useLocation, useMatches } from "@remix-run/react";
import { Feedback } from "@sentry-internal/feedback";
import * as Sentry from "@sentry/remix";
import { startTransition, useEffect } from "react";
import { hydrateRoot } from "react-dom/client";
import packageData from "../package.json";
import config from "./config";

Sentry.init({
  dsn: config.SENTRY_DSN,
  release: config.VERSION,

  debug: true,
  integrations: [
    new Sentry.BrowserTracing({
      tracePropagationTargets: [
        "localhost",
        /^\//,
        // IDK maybe its right
        config.API_SERVER,
        /^https:\/\/api\.peated\.app/,
        /^https:\/\/api\.peated\.com/,
      ],
      routingInstrumentation: Sentry.remixRouterInstrumentation(
        useEffect,
        useLocation,
        useMatches,
      ),
    }),
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
    new Feedback({
      // buttonLabel: "Feedback",
      // submitButtonLabel: "Send Feedback",
      // formTitle: "Feedback 🥔",
      // messagePlaceholder: "What's not working? 😢",
      // showEmail: false,
      themeLight: {
        foreground: "#94a3b8", // slate-400
        background: "#0f172a", // slate-900
        backgroundHover: "#020617", // slate-950
      },
      themeDark: {
        foreground: "#94a3b8", // slate-400
        background: "#0f172a", // slate-900
        backgroundHover: "#020617", // slate-950
      },
    }),
  ],

  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,
});

Sentry.setTag("service", packageData.name);

startTransition(() => {
  hydrateRoot(document, <RemixBrowser />);
});
