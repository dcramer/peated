import { RemixBrowser, useLocation, useMatches } from "@remix-run/react";
import * as Sentry from "@sentry/remix";
import { startTransition, useEffect } from "react";
import { hydrateRoot } from "react-dom/client";
import config from "./config";

import packageData from "../package.json";

Sentry.init({
  dsn: config.SENTRY_DSN,
  release: config.VERSION,

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
  ],

  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,
});

Sentry.setTag("service", packageData.name);

startTransition(() => {
  hydrateRoot(document, <RemixBrowser />);
});
