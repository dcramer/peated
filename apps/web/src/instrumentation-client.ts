// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
import * as Sentry from "@sentry/nextjs";
import { SharedSentryConfig } from "./config";
import { configureLogging } from "./lib/log";

// `sentry local run` sets this so the browser also reports to the local
// Sentry server; the server SDKs read `SENTRY_SPOTLIGHT` on their own.
const spotlightUrl = process.env.NEXT_PUBLIC_SENTRY_SPOTLIGHT;

Sentry.init({
  ...SharedSentryConfig,
  integrations: spotlightUrl
    ? [Sentry.spotlightBrowserIntegration({ sidecarUrl: spotlightUrl })]
    : [],
});

// Tags reach errors only; spans and logs need the attribute.
Sentry.setTag("service", "@peated/web");
Sentry.getGlobalScope().setAttribute("service", "@peated/web");
configureLogging();

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
