// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import { SharedSentryConfig } from "./src/config";
import { configureLogging } from "./src/lib/log";

Sentry.init({
  ...SharedSentryConfig,
});

// Tags reach errors only; spans and logs need the attribute.
Sentry.setTag("service", "@peated/web");
Sentry.getGlobalScope().setAttribute("service", "@peated/web");
configureLogging();
