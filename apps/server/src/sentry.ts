import * as Sentry from "@sentry/node";
import config from "./config";

if (config.ENV !== "test") {
  Sentry.init({
    dsn: config.SENTRY_DSN,
    release: config.VERSION,
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    spotlight: config.ENV === "development",
    includeLocalVariables: true,
    sendDefaultPii: true,

    _experiments: {
      enableLogs: true,
    },
  });

  Sentry.setTag("service", config.SENTRY_SERVICE);
}
