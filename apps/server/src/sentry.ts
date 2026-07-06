import * as Sentry from "@sentry/hono/node";
import config from "./config";
import { configureLogging } from "./lib/log";

type HonoNodeOptionsWithLocalVariables = Parameters<typeof Sentry.init>[0] & {
  includeLocalVariables?: boolean;
};

if (config.ENV !== "test") {
  const sentryOptions = {
    dsn: config.SENTRY_DSN,
    release: config.VERSION,
    tracesSampleRate: 1.0,
    enableLogs: true,
    streamGenAiSpans: true,
    tracePropagationTargets: ["localhost", "api.peated.com", "peated.com"],
    includeLocalVariables: true,
    sendDefaultPii: true,
    integrations: [Sentry.zodErrorsIntegration()],
  } satisfies HonoNodeOptionsWithLocalVariables;

  Sentry.init(sentryOptions);

  Sentry.setTag("service", config.SENTRY_SERVICE);
}

configureLogging();
