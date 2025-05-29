import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import config from "./config";

if (config.ENV !== "test") {
  Sentry.init({
    dsn: config.SENTRY_DSN,
    release: config.VERSION,
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    profileLifecycle: "trace",
    spotlight: config.ENV === "development",
    includeLocalVariables: true,
    sendDefaultPii: true,
    integrations: [
      Sentry.consoleLoggingIntegration(),
      Sentry.zodErrorsIntegration(),
    ],
    _experiments: {
      enableLogs: true,
    },

    integrations: [Sentry.consoleIntegration(), nodeProfilingIntegration()],
  });

  Sentry.setTag("service", config.SENTRY_SERVICE);
}
