import * as Sentry from "@sentry/node";
import { configureCliLogging } from "./log";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  release: process.env.VERSION,
  environment:
    process.env.NODE_ENV === "production" ? "production" : "development",
  tracesSampleRate: 1.0,
  tracePropagationTargets: ["localhost", "api.peated.com", "peated.com"],
  // Server code that the CLI runs creates spans and job trace context through
  // the OpenTelemetry API, which Sentry ignores unless this is on.
  enableOpenTelemetrySetup: true,
  // Sensitive-data rule (docs/policies/sensitive-data.md): the CLI keeps
  // Sentry's restrictive v10 baseline.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: {
      request: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
      response: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
    },
    httpBodies: [],
    urlQueryParams: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
    genAI: { inputs: false, outputs: false },
    databaseQueryData: false,
    queues: false,
    graphQL: { document: false, variables: false },
  },
});

// Tags reach errors only; spans and logs need the attribute.
Sentry.setTag("service", "@peated/cli");
Sentry.getGlobalScope().setAttribute("service", "@peated/cli");
configureCliLogging();
