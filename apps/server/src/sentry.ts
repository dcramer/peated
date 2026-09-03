/**
 * Server Sentry setup owns span filtering. SQL values and local variables stay
 * out of telemetry; callers still own reporting unexpected failures.
 */
import type { StreamedSpanJSON } from "@sentry/core";
import * as Sentry from "@sentry/hono/node";
import config from "./config";
import { normalizeStreamedGenAiSpan } from "./lib/genAiTelemetry";
import { configureLogging } from "./lib/log";

export function prepareSpan(span: StreamedSpanJSON): StreamedSpanJSON {
  const cleaned = { ...span, attributes: { ...span.attributes } };
  delete cleaned.attributes["drizzle.query.params"];
  return normalizeStreamedGenAiSpan(cleaned);
}

if (config.ENV !== "test") {
  const sentryOptions = {
    dsn: config.SENTRY_DSN,
    release: config.VERSION,
    tracesSampleRate: 1.0,
    enableLogs: true,
    streamGenAiSpans: true,
    beforeSendSpan: Sentry.withStreamedSpan(prepareSpan),
    tracePropagationTargets: ["localhost", "api.peated.com", "peated.com"],
    sendDefaultPii: true,
    integrations: [Sentry.zodErrorsIntegration()],
  } satisfies Parameters<typeof Sentry.init>[0];

  Sentry.init(sentryOptions);

  Sentry.setTag("service", config.SENTRY_SERVICE);
}

configureLogging();

export async function flushSentry(timeoutMs: number) {
  await Sentry.flush(timeoutMs);
}
