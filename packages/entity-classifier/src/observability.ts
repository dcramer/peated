import { startSpan } from "@sentry/core";

const MAX_ATTRIBUTE_LENGTH = 12_000;

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
    callback,
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
