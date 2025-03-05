// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import * as Spotlight from "@spotlightjs/spotlight";
import { SharedSentryConfig } from "./src/config";

Sentry.init({
  ...SharedSentryConfig,

  replaysOnErrorSampleRate: 1.0,

  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here, for example:
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  _experiments: {
    enableLogs: true,
  },
});

Sentry.setTag("service", "@peated/web");

if (process.env.NODE_ENV === "development") {
  Spotlight.init();
}
