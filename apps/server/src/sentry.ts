import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import config from "./config";

if (config.ENV !== "test") {
  Sentry.init({
    dsn: config.SENTRY_DSN,
    release: config.VERSION,
    tracesSampleRate: 1.0,
    tracePropagationTargets: ["localhost", "api.peated.com", "peated.com"],
    profilesSampleRate: 1.0,
    profileLifecycle: "trace",
    spotlight: config.ENV === "development",
    includeLocalVariables: true,
    sendDefaultPii: true,
    integrations: [
      Sentry.consoleLoggingIntegration(),
      Sentry.zodErrorsIntegration(),
      nodeProfilingIntegration(),
    ],
    _experiments: {
      enableLogs: true,
    },
  });

  Sentry.setTag("service", config.SENTRY_SERVICE);
}
