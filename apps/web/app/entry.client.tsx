import { RemixBrowser, useLocation, useMatches } from "@remix-run/react";
import { feedbackModalIntegration } from "@sentry-internal/feedback";
import * as Sentry from "@sentry/remix";
import { startTransition, useEffect } from "react";
import { hydrateRoot } from "react-dom/client";
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

  tracePropagationTargets: [
    "localhost",
    /^\//,
    // IDK maybe its right
    config.API_SERVER,
    /^https:\/\/api\.peated\.app/,
    /^https:\/\/api\.peated\.com/,
  ],

  debug: false,
  integrations: [
    Sentry.browserTracingIntegration({
      useEffect,
      useLocation,
      useMatches,
    }),
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
    Sentry.feedbackIntegration({
      // buttonLabel: "Feedback",
      // submitButtonLabel: "Send Feedback",
      // formTitle: "Feedback 🥔",
      // messagePlaceholder: "What's not working? 😢",
      // showEmail: false,
      themeLight: feedbackTheme,
      themeDark: feedbackTheme,
      autoInject: false,
      showScreenshot: false,
    }),
    feedbackModalIntegration(),
  ],

  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,
});

Sentry.setTag("service", "@peated/web");

startTransition(() => {
  hydrateRoot(document, <RemixBrowser />);
});

if (process.env.NODE_ENV === "development") {
  import("@spotlightjs/spotlight").then((Spotlight) =>
    Spotlight.init({ injectImmediately: true }),
  );
}
