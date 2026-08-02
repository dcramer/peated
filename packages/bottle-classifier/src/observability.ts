import { startSpan } from "@sentry/core";

const MAX_ATTRIBUTE_LENGTH = 12_000;
const OPENAI_PROVIDER = "openai";

export type AgentSpanAttributes = Record<
  string,
  boolean | number | string | string[] | undefined
>;

function compactJson(value: unknown): string {
  const serialized = JSON.stringify(value) ?? String(value);
  if (serialized.length <= MAX_ATTRIBUTE_LENGTH) {
    return serialized;
  }

  return `${serialized.slice(0, MAX_ATTRIBUTE_LENGTH)}...`;
}

function objectProperty(value: unknown, property: string): unknown {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)[property]
    : undefined;
}

function measuredNumber(value: unknown, property: string): number | undefined {
  const candidate = objectProperty(value, property);
  return typeof candidate === "number" && Number.isFinite(candidate)
    ? candidate
    : undefined;
}

function usageDetailTotal(
  usage: unknown,
  detailsProperty: string,
  valueProperties: string[],
): number | undefined {
  const details = objectProperty(usage, detailsProperty);
  const entries = Array.isArray(details) ? details : details ? [details] : [];
  let measured = false;
  let total = 0;

  for (const entry of entries) {
    for (const property of valueProperties) {
      const value = measuredNumber(entry, property);
      if (value !== undefined) {
        measured = true;
        total += value;
        break;
      }
    }
  }

  return measured ? total : undefined;
}

function getAgentResultUsage(result: unknown): unknown {
  const metadataUsage = objectProperty(
    objectProperty(result, "modelMetadata"),
    "usage",
  );
  return (
    metadataUsage ??
    objectProperty(objectProperty(result, "state"), "usage") ??
    objectProperty(objectProperty(result, "runContext"), "usage") ??
    objectProperty(result, "usage")
  );
}

function setAgentResultAttributes(
  span: { setAttribute: (key: string, value: string | number) => void },
  result: unknown,
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

/**
 * Builds `gen_ai.execute_tool` metadata with compact JSON tool arguments.
 */
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

/**
 * Wraps a classifier agent run in Sentry's `gen_ai.invoke_agent` span while
 * preserving the caller-owned conversation id.
 */
export async function startAgentSpan<T>({
  name,
  conversationId,
  attributes = {},
  callback,
}: {
  name: string;
  conversationId: string;
  attributes?: AgentSpanAttributes;
  callback: () => Promise<T>;
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

/**
 * Wraps tool execution in `gen_ai.execute_tool` and records compact JSON
 * arguments/results so spans stay useful without carrying oversized payloads.
 */
export async function startToolSpan<T>({
  name,
  description,
  args,
  callback,
}: {
  name: string;
  description: string;
  args: unknown;
  callback: () => Promise<T>;
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
