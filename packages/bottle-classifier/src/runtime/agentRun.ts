import {
  generateText,
  isStepCount,
  jsonSchema,
  Output,
  tool,
  type JSONSchema7,
  type JSONValue,
  type LanguageModel,
  type ToolSet,
} from "ai";
import { zodFunction } from "openai/helpers/zod";
import { z } from "zod";
import type { OpenAIReasoningEffort } from "../openaiModelSettings";

export type AgentToolCall = { toolCallId: string };

/** Tool input as the model sent it, before the tool parses it. */
export type AgentToolInput = JSONValue;

/** What a tool returns; the model receives it as JSON. */
export type AgentToolOutput = JSONValue;

/**
 * A tool the classifier agents can call. Each tool parses its own input, so
 * the model library only sees the JSON schema.
 */
export type AgentTool = {
  name: string;
  description: string;
  inputSchema: JSONSchema7;
  // Strict tools constrain the model to the schema. Two proposal tools accept
  // extra fields so the collector can explain a rejected proposal.
  strict: boolean;
  execute(input: AgentToolInput, call: AgentToolCall): Promise<AgentToolOutput>;
};

const JsonValueSchema = z.json();
type JsonValue = z.infer<typeof JsonValueSchema>;
const JsonSchemaObjectSchema = z.record(z.string(), JsonValueSchema);

/**
 * Removes `format` keywords. OpenAI strict schemas reject formats such as
 * `uri`; field descriptions still say what each value is.
 */
export function stripProviderUnsupportedFormats(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(stripProviderUnsupportedFormats);
  }
  const objectValue = JsonSchemaObjectSchema.safeParse(value);
  if (!objectValue.success) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(objectValue.data).flatMap(([key, child]) =>
      key === "format" ? [] : [[key, stripProviderUnsupportedFormats(child)]],
    ),
  );
}

/** A strict tool whose input is parsed with `parameters`. */
export function strictAgentTool<Input>({
  name,
  description,
  parameters,
  execute,
}: {
  name: string;
  description: string;
  parameters: z.ZodType<Input>;
  execute: (input: Input, call: AgentToolCall) => Promise<AgentToolOutput>;
}): AgentTool {
  return {
    name,
    description,
    // The OpenAI helper makes every field required and nullable when
    // unknown, which strict tool calls need.
    // SAFETY: zodFunction always returns a JSON Schema object, and removing
    // `format` keywords keeps it one.
    inputSchema: stripProviderUnsupportedFormats(
      JsonValueSchema.parse(
        JSON.parse(
          JSON.stringify(zodFunction({ name, parameters }).function.parameters),
        ),
      ),
    ) as JSONSchema7,
    strict: true,
    execute: async (input, call) =>
      await execute(parameters.parse(input), call),
  };
}

export type AgentRunUsage = {
  requests: number;
  inputTokens?: number;
  cachedInputTokens?: number;
  cacheWriteTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
};

export type AgentToolResult = { name: string; output: unknown };

export type AgentRunResult = {
  output: unknown;
  toolResults: AgentToolResult[];
  usage: AgentRunUsage;
};

export type AgentRunRequest = {
  model: LanguageModel;
  functionId: string;
  instructions: string;
  input: string;
  tools: AgentTool[];
  output: { name: string; schema: JSONSchema7 };
  maxTurns: number;
  temperature?: number;
  reasoning?: OpenAIReasoningEffort;
  signal?: AbortSignal;
};

function toToolSet(tools: AgentTool[]): ToolSet {
  return Object.fromEntries(
    tools.map((agentTool) => [
      agentTool.name,
      tool({
        description: agentTool.description,
        inputSchema: jsonSchema(agentTool.inputSchema),
        strict: agentTool.strict,
        execute: async (input, { toolCallId }) =>
          await agentTool.execute(input, { toolCallId }),
      }),
    ]),
  );
}

/** Runs one classifier agent: tool calls until a final structured answer. */
export async function runAgent({
  model,
  functionId,
  instructions,
  input,
  tools,
  output,
  maxTurns,
  temperature,
  reasoning,
  signal,
}: AgentRunRequest): Promise<AgentRunResult> {
  const result = await generateText({
    model,
    instructions,
    prompt: input,
    tools: toToolSet(tools),
    output: Output.object({
      schema: jsonSchema(output.schema),
      name: output.name,
    }),
    // Each model call is one turn, as the agents were tuned.
    stopWhen: isStepCount(maxTurns),
    temperature,
    reasoning,
    abortSignal: signal,
    // One tool call per turn: later calls depend on earlier results.
    providerOptions: { openai: { parallelToolCalls: false } },
    telemetry: { functionId },
  });

  const usage = result.totalUsage;
  return {
    output: result.output,
    toolResults: result.steps.flatMap((step) =>
      step.toolResults.map((toolResult) => ({
        name: toolResult.toolName,
        output: toolResult.output,
      })),
    ),
    usage: {
      requests: result.steps.length,
      inputTokens: usage.inputTokens,
      cachedInputTokens: usage.inputTokenDetails.cacheReadTokens,
      cacheWriteTokens: usage.inputTokenDetails.cacheWriteTokens,
      outputTokens: usage.outputTokens,
      reasoningTokens: usage.outputTokenDetails.reasoningTokens,
      totalTokens: usage.totalTokens,
    },
  };
}
