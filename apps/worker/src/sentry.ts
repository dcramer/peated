import * as Sentry from "@sentry/node-experimental";
import { ProfilingIntegration } from "@sentry/profiling-node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  release: process.env.VERSION,
  environment:
    process.env.NODE_ENV === "production" ? "production" : "development",
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
  integrations: [new ProfilingIntegration()],
  spotlight: process.env.NODE_ENV !== "production",
});

Sentry.setTag("service", "@peated/worker");
