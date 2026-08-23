/**
 * Owns classifier span metadata. Tool payloads are bounded before they reach
 * tracing and callers must keep them limited to public catalog/source data.
 */
import { startSpan as startSentrySpan, type Span } from "@sentry/core";
import { z } from "zod";

const MAX_ATTRIBUTE_LENGTH = 12_000;
const OPENAI_PROVIDER = "openai";

export type AgentSpanAttributes = Record<
  string,
  boolean | number | string | string[] | undefined
>;

function compactJson(value: Parameters<typeof JSON.stringify>[0]): string {
  const serialized = JSON.stringify(value) ?? String(value);
  if (serialized.length <= MAX_ATTRIBUTE_LENGTH) {
    return serialized;
  }

  return `${serialized.slice(0, MAX_ATTRIBUTE_LENGTH)}...`;
}

const TokenDetailsSchema = z.union([
  z.record(z.string(), z.number()),
  z.array(z.record(z.string(), z.number())),
]);
const AgentUsageSchema = z
  .object({
    inputTokens: z.number().optional(),
    cachedInputTokens: z.number().optional(),
    cacheWriteTokens: z.number().optional(),
    outputTokens: z.number().optional(),
    reasoningTokens: z.number().optional(),
    inputTokensDetails: TokenDetailsSchema.optional(),
    outputTokensDetails: TokenDetailsSchema.optional(),
  })
  .passthrough();
const UsageOwnerSchema = z
  .object({ usage: AgentUsageSchema.optional() })
  .passthrough();
const AgentResultSchema = z
  .object({
    modelMetadata: UsageOwnerSchema.optional(),
    state: UsageOwnerSchema.optional(),
    runContext: UsageOwnerSchema.optional(),
    usage: AgentUsageSchema.optional(),
  })
  .passthrough();
type AgentResultInput = Parameters<typeof AgentResultSchema.safeParse>[0];
type AgentUsage = z.infer<typeof AgentUsageSchema>;
type UsageNumberProperty =
  | "cachedInputTokens"
  | "cacheWriteTokens"
  | "inputTokens"
  | "outputTokens"
  | "reasoningTokens";
type UsageDetailsProperty = "inputTokensDetails" | "outputTokensDetails";

function measuredNumber(
  usage: AgentUsage | undefined,
  property: UsageNumberProperty,
): number | undefined {
  const candidate = usage?.[property];
  const measured = z.number().finite().safeParse(candidate);
  return measured.success ? measured.data : undefined;
}

function usageDetailTotal(
  usage: AgentUsage | undefined,
  detailsProperty: UsageDetailsProperty,
  valueProperties: string[],
): number | undefined {
  const details = usage?.[detailsProperty];
  const entries = Array.isArray(details) ? details : details ? [details] : [];
  let measured = false;
  let total = 0;

  for (const entry of entries) {
    for (const property of valueProperties) {
      const value = entry[property];
      if (value !== undefined) {
        measured = true;
        total += value;
        break;
      }
    }
  }

  return measured ? total : undefined;
}

function getAgentResultUsage(result: AgentResultInput): AgentUsage | undefined {
  const parsed = AgentResultSchema.safeParse(result);
  if (!parsed.success) return undefined;

  return (
    parsed.data.modelMetadata?.usage ??
    parsed.data.state?.usage ??
    parsed.data.runContext?.usage ??
    parsed.data.usage
  );
}

function setAgentResultAttributes(
  span: { setAttribute: (key: string, value: string | number) => void },
  result: AgentResultInput,
) {
  const usage = getAgentResultUsage(result);
  const attributes = {
    "gen_ai.usage.input_tokens": measuredNumber(usage, "inputTokens"),
    "gen_ai.usage.cache_read.input_tokens":
      measuredNumber(usage, "cachedInputTokens") ??
      usageDetailTotal(usage, "inputTokensDetails", [
        "cached_tokens",
        "cachedTokens",
      ]),
    "gen_ai.usage.cache_creation.input_tokens":
      measuredNumber(usage, "cacheWriteTokens") ??
      usageDetailTotal(usage, "inputTokensDetails", [
        "cache_write_tokens",
        "cacheWriteTokens",
      ]),
    "gen_ai.usage.output_tokens": measuredNumber(usage, "outputTokens"),
    "gen_ai.usage.reasoning.output_tokens":
      measuredNumber(usage, "reasoningTokens") ??
      usageDetailTotal(usage, "outputTokensDetails", [
        "reasoning_tokens",
        "reasoningTokens",
      ]),
  };

  for (const [key, value] of Object.entries(attributes)) {
    if (value !== undefined) {
      span.setAttribute(key, value);
    }
  }
}

/**
 * Builds `gen_ai.invoke_agent` metadata with the caller-owned conversation id.
 */
export function buildAgentSpanContext({
  name,
  conversationId,
  attributes = {},
}: {
  name: string;
  conversationId: string;
  attributes?: AgentSpanAttributes;
}) {
  return {
    op: "gen_ai.invoke_agent",
    name: `invoke_agent ${name}`,
    attributes: {
      "gen_ai.operation.name": "invoke_agent",
      "gen_ai.provider.name": OPENAI_PROVIDER,
      "gen_ai.agent.name": name,
      "gen_ai.conversation.id": conversationId,
      ...attributes,
    },
  };
}

export function buildToolSpanContext({
  name,
  description,
  args,
}: {
  name: string;
  description: string;
  args: unknown;
}) {
  return {
    op: "gen_ai.execute_tool",
    name: `execute_tool ${name}`,
    attributes: {
      "gen_ai.operation.name": "execute_tool",
      "gen_ai.tool.name": name,
      "gen_ai.tool.description": description,
      "gen_ai.tool.call.arguments": compactJson(args),
    },
  };
}

export type ClassifierSpanContext =
  | ReturnType<typeof buildAgentSpanContext>
  | ReturnType<typeof buildToolSpanContext>;

export type ClassifierSpanStarter = <T>(
  context: ClassifierSpanContext,
  callback: (span: Span) => Promise<T>,
) => Promise<T>;

const defaultClassifierSpanStarter: ClassifierSpanStarter = async (
  context,
  callback,
) => await startSentrySpan(context, callback);

/**
 * Wraps a classifier agent run in Sentry's `gen_ai.invoke_agent` span while
 * preserving the caller-owned conversation id.
 */
export async function startAgentSpan<T>({
  name,
  conversationId,
  attributes = {},
  callback,
  startSpan = defaultClassifierSpanStarter,
}: {
  name: string;
  conversationId: string;
  attributes?: AgentSpanAttributes;
  callback: () => Promise<T>;
  startSpan?: ClassifierSpanStarter;
}): Promise<T> {
  return await startSpan(
    buildAgentSpanContext({ name, conversationId, attributes }),
    async (span) => {
      const result = await callback();
      setAgentResultAttributes(span, result);
      return result;
    },
  );
}

/** Wraps tool execution and records bounded public catalog/source payloads. */
export async function startToolSpan<T>({
  name,
  description,
  args,
  callback,
  startSpan = defaultClassifierSpanStarter,
}: {
  name: string;
  description: string;
  args: unknown;
  callback: () => Promise<T>;
  startSpan?: ClassifierSpanStarter;
}): Promise<T> {
  return await startSpan(
    buildToolSpanContext({ name, description, args }),
    async (span) => {
      const result = await callback();
      span.setAttribute("gen_ai.tool.call.result", compactJson(result));
      return result;
    },
  );
}
