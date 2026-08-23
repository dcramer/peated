import {
  SpanKind,
  SpanStatusCode,
  trace,
  type Attributes,
  type Span,
} from "@opentelemetry/api";

type OpenAIResponsesTelemetry = {
  response: {
    id: string;
    model: string;
    serviceTier: string | null;
  };
  usage: {
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
  } | null;
};

const tracer = trace.getTracer("@peated/server");

export function buildOpenAIResponsesRequestAttributes({
  baseURL,
  conversationId,
  model,
}: {
  baseURL: string;
  conversationId: string;
  model: string;
}): Attributes {
  const endpoint = new URL(baseURL);

  const attributes: Attributes = {
    "gen_ai.operation.name": "chat",
    "gen_ai.provider.name": "openai",
    "gen_ai.request.model": model,
    "gen_ai.request.stream": false,
    "gen_ai.output.type": "json",
    "gen_ai.conversation.id": conversationId,
    "openai.api.type": "responses",
    "server.address": endpoint.hostname,
    "sentry.op": "gen_ai.chat",
  };
  if (endpoint.port) attributes["server.port"] = Number(endpoint.port);
  return attributes;
}

export function buildOpenAIResponsesResponseAttributes({
  response,
  usage,
}: OpenAIResponsesTelemetry): Attributes {
  const attributes: Attributes = {
    "gen_ai.response.id": response.id,
    "gen_ai.response.model": response.model,
  };
  if (response.serviceTier) {
    attributes["openai.response.service_tier"] = response.serviceTier;
  }
  if (usage) {
    attributes["gen_ai.usage.input_tokens"] = usage.inputTokens;
    attributes["gen_ai.usage.cache_read.input_tokens"] =
      usage.cachedInputTokens;
    attributes["gen_ai.usage.output_tokens"] = usage.outputTokens;
    attributes["gen_ai.usage.reasoning.output_tokens"] = usage.reasoningTokens;
  }
  return attributes;
}

function recordResponse(span: Span, metadata: OpenAIResponsesTelemetry) {
  span.setAttributes(buildOpenAIResponsesResponseAttributes(metadata));
}

function getErrorType(error: Error): string {
  return error.constructor.name;
}

/**
 * Records one content-free OpenTelemetry inference span around an OpenAI
 * Responses API call. The callback reports provider metadata as soon as the
 * response arrives so billed usage survives any later parsing failure.
 */
export async function instrumentOpenAIResponsesCall<T>({
  baseURL,
  callback,
  conversationId,
  model,
}: {
  baseURL: string;
  callback: (
    reportResponse: (metadata: OpenAIResponsesTelemetry) => void,
  ) => Promise<T>;
  conversationId: string;
  model: string;
}): Promise<T> {
  return await tracer.startActiveSpan(
    `chat ${model}`,
    {
      kind: SpanKind.CLIENT,
      attributes: buildOpenAIResponsesRequestAttributes({
        baseURL,
        conversationId,
        model,
      }),
    },
    async (span) => {
      try {
        return await callback((metadata) => recordResponse(span, metadata));
      } catch (cause) {
        const error =
          cause instanceof Error
            ? cause
            : new Error("OpenAI Responses call failed.", { cause });
        span.setAttribute("error.type", getErrorType(error));
        span.setStatus({ code: SpanStatusCode.ERROR });
        span.recordException(error);
        throw cause;
      } finally {
        span.end();
      }
    },
  );
}
