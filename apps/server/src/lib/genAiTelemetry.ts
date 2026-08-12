import type { StreamedSpanJSON } from "@sentry/core";

type SentrySpanJson = {
  op?: string;
  data?: Record<string, unknown>;
};

/**
 * Bridges Sentry's OpenAI integration from the legacy `gen_ai.system`
 * discriminator to the current OpenTelemetry provider attribute.
 */
export function normalizeGenAiSpan<T extends SentrySpanJson>(span: T): T {
  if (
    !span.op?.startsWith("gen_ai.") ||
    span.data?.["gen_ai.provider.name"] !== undefined ||
    span.data?.["gen_ai.system"] !== "openai"
  ) {
    return span;
  }

  return {
    ...span,
    data: {
      ...span.data,
      "gen_ai.provider.name": "openai",
    },
  };
}

/** Adds the current provider attribute to Sentry's streamed span format. */
export function normalizeStreamedGenAiSpan(
  span: StreamedSpanJSON,
): StreamedSpanJSON {
  const attributes = span.attributes;
  if (!attributes) {
    return span;
  }

  const operation = attributeValue(attributes?.["sentry.op"]);
  if (operation !== "gen_ai.chat" && operation !== "gen_ai.embeddings") {
    return span;
  }

  if (
    attributes["gen_ai.provider.name"] !== undefined ||
    attributeValue(attributes["gen_ai.system"]) !== "openai"
  ) {
    return span;
  }

  return {
    ...span,
    attributes: {
      ...attributes,
      "gen_ai.provider.name": "openai",
    },
  };
}

function attributeValue(value: unknown): unknown {
  return value && typeof value === "object" && "value" in value
    ? (value as { value: unknown }).value
    : value;
}
