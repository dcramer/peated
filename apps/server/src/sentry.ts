import * as Sentry from "@sentry/node";
import config from "./config";

Sentry.init({
  dsn: config.SENTRY_DSN,
  release: config.VERSION,
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
  spotlight: config.ENV === "development",
});

Sentry.setTag("service", config.SENTRY_SERVICE);
