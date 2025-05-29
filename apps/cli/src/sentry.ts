import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  release: process.env.VERSION,
  environment:
    process.env.NODE_ENV === "production" ? "production" : "development",
  tracesSampleRate: 1.0,
  tracePropagationTargets: ["localhost", "api.peated.com", "peated.com"],
  profilesSampleRate: 1.0,
  spotlight: process.env.NODE_ENV !== "production",
  integrations: [Sentry.consoleLoggingIntegration()],
  _experiments: {
    enableLogs: true,
  },
});

Sentry.setTag("service", "@peated/cli");
