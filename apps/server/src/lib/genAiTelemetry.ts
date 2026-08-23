import type { StreamedSpanJSON } from "@sentry/core";
import { z } from "zod";

type SentrySpanJson = {
  op?: string;
  data?: StreamedSpanJSON["attributes"];
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

  const operation = SpanAttributeValueSchema.parse(attributes?.["sentry.op"]);
  if (operation !== "gen_ai.chat" && operation !== "gen_ai.embeddings") {
    return span;
  }

  if (
    attributes["gen_ai.provider.name"] !== undefined ||
    SpanAttributeValueSchema.parse(attributes["gen_ai.system"]) !== "openai"
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

const SpanAttributeValueSchema = z
  .union([
    z.string(),
    z.object({ value: z.string() }).transform(({ value }) => value),
  ])
  .optional()
  .catch(undefined);
