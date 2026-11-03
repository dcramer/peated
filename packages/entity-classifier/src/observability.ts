/**
 * Owns classifier span metadata. The AI SDK traces each agent run, model call,
 * and tool call on its own, with complete input and output, so one run reads as
 * one agent in Sentry. This span only groups that run and adds classifier facts
 * such as the Entity being checked. It must not repeat the
 * AI SDK's agent, tool, or token-usage data.
 */
import { startSpan as startSentrySpan, type Span } from "@sentry/core";

export type ClassifierSpanAttributes = Record<
  string,
  boolean | number | string | string[] | undefined
>;

export function buildClassifierRunSpanContext({
  name,
  conversationId,
  attributes = {},
}: {
  name: string;
  conversationId: string;
  attributes?: ClassifierSpanAttributes;
}) {
  return {
    op: "entity_classifier.run",
    name,
    attributes: {
      "gen_ai.conversation.id": conversationId,
      ...attributes,
    },
  };
}

export type ClassifierSpanContext = ReturnType<
  typeof buildClassifierRunSpanContext
>;

export type ClassifierSpanStarter = <T>(
  context: ClassifierSpanContext,
  callback: (span: Span) => Promise<T>,
) => Promise<T>;

const defaultClassifierSpanStarter: ClassifierSpanStarter = async (
  context,
  callback,
) => await startSentrySpan(context, callback);

/** Groups one classifier run under its caller-owned conversation id. */
export async function startClassifierRunSpan<T>({
  name,
  conversationId,
  attributes = {},
  callback,
  startSpan = defaultClassifierSpanStarter,
}: {
  name: string;
  conversationId: string;
  attributes?: ClassifierSpanAttributes;
  callback: () => Promise<T>;
  startSpan?: ClassifierSpanStarter;
}): Promise<T> {
  return await startSpan(
    buildClassifierRunSpanContext({ name, conversationId, attributes }),
    async () => await callback(),
  );
}
