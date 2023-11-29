import { RemixBrowser, useLocation, useMatches } from "@remix-run/react";
import { Feedback } from "@sentry-internal/feedback";
import * as Sentry from "@sentry/remix";
import { startTransition, useEffect } from "react";
import { hydrateRoot } from "react-dom/client";
import packageData from "../package.json";
import config from "./config";

const feedbackTheme = {
  foreground: "#94a3b8", // slate-400
  background: "#0f172a", // slate-900
  backgroundHover: "#020617", // slate-950
  submitBackground: "#fbbf24", // amber-400
  submitForeground: "#000000", // black
  submitBorder: "none", // amber-400
  submitBackgroundHover: "#fbbf24", // amber-400
  inputBackground: "#020617", // slate-950
  inputBorder: "none", // slate-950
  inputBorderFocus: "#020617", // slate-950
  inputForeground: "#ffffff", // white
};

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
      themeLight: feedbackTheme,
      themeDark: feedbackTheme,
      autoInject: false,
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

if (process.env.NODE_ENV === "development") {
  import("@spotlightjs/spotlight").then((Spotlight) =>
    Spotlight.init({ injectImmediately: true }),
  );
}
