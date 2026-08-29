/**
 * Owns the standard trace shape for local agents. Agent and tool failures set
 * span status but do not create Sentry issues at this boundary.
 */
import { SpanStatusCode, trace, type Attributes } from "@opentelemetry/api";
import { withSentryConversation } from "./openaiClient";

const tracer = trace.getTracer("@peated/server");

type AgentPrompt = {
  name: string;
  version: string;
};

type AgentRunResult<T> = {
  model: string;
  output: string;
  value: T;
};

export function buildAgentSpanAttributes(input: {
  attributes?: Attributes;
  conversationId: string;
  instructions: string;
  name: string;
  prompt: AgentPrompt;
  task: string;
  toolDefinitions?: string;
}): Attributes {
  const attributes: Attributes = {
    ...input.attributes,
    "gen_ai.agent.name": input.name,
    "gen_ai.conversation.id": input.conversationId,
    "gen_ai.input.messages": JSON.stringify([
      {
        role: "user",
        parts: [{ type: "text", content: input.task }],
      },
    ]),
    "gen_ai.operation.name": "invoke_agent",
    "gen_ai.prompt.name": input.prompt.name,
    "gen_ai.prompt.version": input.prompt.version,
    "gen_ai.system_instructions": JSON.stringify([
      { type: "text", content: input.instructions },
    ]),
    "sentry.op": "gen_ai.invoke_agent",
  };
  if (input.toolDefinitions) {
    attributes["gen_ai.tool.definitions"] = input.toolDefinitions;
  }
  return attributes;
}

export function buildAgentToolSpanAttributes(input: {
  agentName: string;
  argumentsJson: string;
  attributes?: Attributes;
  callId: string;
  description: string;
  name: string;
}): Attributes {
  return {
    ...input.attributes,
    "gen_ai.agent.name": input.agentName,
    "gen_ai.operation.name": "execute_tool",
    "gen_ai.tool.call.arguments": input.argumentsJson,
    "gen_ai.tool.call.id": input.callId,
    "gen_ai.tool.description": input.description,
    "gen_ai.tool.name": input.name,
    "gen_ai.tool.type": "function",
    "sentry.op": "gen_ai.execute_tool",
  };
}

function outputMessage(content: string) {
  return JSON.stringify([
    {
      role: "assistant",
      parts: [{ type: "text", content }],
      finish_reason: "stop",
    },
  ]);
}

function errorType(error: Error) {
  return error.constructor.name;
}

export async function runAgent<T>(input: {
  attributes?: Attributes;
  conversationId: string;
  instructions: string;
  name: string;
  prompt: AgentPrompt;
  run: () => Promise<AgentRunResult<T>>;
  task: string;
  toolDefinitions?: string;
}): Promise<T> {
  return await withSentryConversation(input.conversationId, async () => {
    return await tracer.startActiveSpan(
      `invoke_agent ${input.name}`,
      { attributes: buildAgentSpanAttributes(input) },
      async (span) => {
        try {
          const result = await input.run();
          span.setAttributes({
            "gen_ai.output.messages": outputMessage(result.output),
            "gen_ai.request.model": result.model,
          });
          return result.value;
        } catch (cause) {
          const error =
            cause instanceof Error
              ? cause
              : new Error("Agent run failed.", { cause });
          span.setAttribute("error.type", errorType(error));
          span.setStatus({ code: SpanStatusCode.ERROR });
          throw cause;
        } finally {
          span.end();
        }
      },
    );
  });
}

export async function runAgentTool<T>(input: {
  agentName: string;
  argumentsJson: string;
  attributes?: Attributes;
  callId: string;
  description: string;
  name: string;
  run: () => Promise<{ output: string; value: T }>;
}): Promise<T> {
  return await tracer.startActiveSpan(
    `execute_tool ${input.name}`,
    { attributes: buildAgentToolSpanAttributes(input) },
    async (span) => {
      try {
        const result = await input.run();
        span.setAttribute("gen_ai.tool.call.result", result.output);
        return result.value;
      } catch (cause) {
        const error =
          cause instanceof Error
            ? cause
            : new Error("Agent tool failed.", { cause });
        span.setAttribute("error.type", errorType(error));
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw cause;
      } finally {
        span.end();
      }
    },
  );
}
