/**
 * Server Sentry setup owns span filtering. SQL values and local variables stay
 * out of telemetry; callers still own reporting unexpected failures.
 */
import type { StreamedSpanJSON } from "@sentry/core";
import * as Sentry from "@sentry/hono/node";
import config from "./config";
import { configureLogging } from "./lib/log";

export function prepareSpan(span: StreamedSpanJSON): StreamedSpanJSON {
  const cleaned = { ...span, attributes: { ...span.attributes } };
  delete cleaned.attributes["drizzle.query.params"];
  return cleaned;
}

if (config.ENV !== "test") {
  const sentryOptions = {
    dsn: config.SENTRY_DSN,
    release: config.VERSION,
    tracesSampleRate: 1.0,
    // Drizzle, our model-call spans, and job trace propagation use the
    // OpenTelemetry API, which Sentry ignores unless this is on.
    enableOpenTelemetrySetup: true,
    beforeSendSpan: prepareSpan,
    tracePropagationTargets: ["localhost", "api.peated.com", "peated.com"],
    // Sensitive-data rule (docs/policies/sensitive-data.md): no session
    // cookies, request or response bodies, SQL values, or local variables.
    dataCollection: {
      cookies: false,
      httpBodies: [],
      databaseQueryData: false,
      stackFrameVariables: false,
    },
    integrations: [Sentry.zodErrorsIntegration()],
  } satisfies Parameters<typeof Sentry.init>[0];

  Sentry.init(sentryOptions);

  // Tags reach errors only; spans and logs need the attribute.
  Sentry.setTag("service", config.SENTRY_SERVICE);
  Sentry.getGlobalScope().setAttribute("service", config.SENTRY_SERVICE);
}

configureLogging();

export async function flushSentry(timeoutMs: number) {
  await Sentry.flush(timeoutMs);
}
