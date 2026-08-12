import { startSpan } from "@sentry/core";

const OPENAI_PROVIDER = "openai";

export type AgentSpanAttributes = Record<
  string,
  boolean | number | string | string[] | undefined
>;

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
  return (
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
    "gen_ai.usage.cache_read.input_tokens": usageDetailTotal(
      usage,
      "inputTokensDetails",
      ["cached_tokens", "cachedTokens"],
    ),
    "gen_ai.usage.cache_creation.input_tokens": usageDetailTotal(
      usage,
      "inputTokensDetails",
      ["cache_write_tokens", "cacheWriteTokens"],
    ),
    "gen_ai.usage.output_tokens": measuredNumber(usage, "outputTokens"),
    "gen_ai.usage.reasoning.output_tokens": usageDetailTotal(
      usage,
      "outputTokensDetails",
      ["reasoning_tokens", "reasoningTokens"],
    ),
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
 * Builds content-free `gen_ai.execute_tool` metadata.
 */
export function buildToolSpanContext({
  name,
  description,
}: {
  name: string;
  description: string;
}) {
  return {
    op: "gen_ai.execute_tool",
    name: `execute_tool ${name}`,
    attributes: {
      "gen_ai.operation.name": "execute_tool",
      "gen_ai.tool.name": name,
      "gen_ai.tool.description": description,
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
 * Wraps tool execution without recording model-controlled arguments or results.
 */
export async function startToolSpan<T>({
  name,
  description,
  callback,
}: {
  name: string;
  description: string;
  callback: () => Promise<T>;
}): Promise<T> {
  return await startSpan(buildToolSpanContext({ name, description }), callback);
}
