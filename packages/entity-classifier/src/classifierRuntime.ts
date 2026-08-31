import { Agent, OpenAIProvider, Runner } from "@openai/agents";
import type OpenAI from "openai";
import {
  EntityClassificationAdviceSchema,
  EntityResolutionSchema,
  SearchEntitiesArgsSchema,
  type EntityClassificationAdvice,
  type EntityClassificationContext,
  type EntityResolution,
  type SearchEntitiesArgs,
} from "./classifierTypes";
import {
  ClassifyEntityInputSchema,
  EntityClassificationResultSchema,
  buildEntityClassificationArtifacts,
  type ClassifyEntityInput,
  type EntityClassificationArtifacts,
  type EntityClassificationResult,
} from "./contract";
import { EntityClassificationError } from "./error";
import { buildEntityClassifierInstructions } from "./instructions";
import { startAgentSpan } from "./observability";
import { getDeterministicOpenAISettings } from "./openaiModelSettings";
import { finalizeEntityClassification } from "./reviewPolicy";
import { createOpenAIWebSearchTool, createSearchEntitiesTool } from "./tools";

const ENTITY_CLASSIFIER_MAX_TURNS = 8;

export type RunEntityClassifierAgentInput = {
  context: EntityClassificationContext;
};

export type EntityClassifierAdapters = {
  searchEntities?: (args: SearchEntitiesArgs) => Promise<EntityResolution[]>;
};

export type CreateEntityClassifierOptions = {
  client: OpenAI;
  model: string;
  maxSearchQueries: number;
  adapters: EntityClassifierAdapters;
  overrides?: {
    runEntityClassifierAgent?: (
      input: RunEntityClassifierAgentInput,
    ) => Promise<EntityClassificationResult>;
  };
};

export type EntityClassifier = {
  classifyEntity: (
    input: ClassifyEntityInput,
  ) => Promise<EntityClassificationResult>;
  runEntityClassifierAgent: (
    input: RunEntityClassifierAgentInput,
  ) => Promise<EntityClassificationResult>;
};

function mergeResolvedEntity(
  results: Map<number, EntityResolution>,
  candidate: EntityResolution,
) {
  const existing = results.get(candidate.entityId);
  if (!existing) {
    results.set(candidate.entityId, candidate);
    return;
  }

  existing.source = Array.from(
    new Set([...existing.source, ...candidate.source]),
  );

  if (
    candidate.score !== null &&
    (existing.score === null || candidate.score > existing.score)
  ) {
    existing.score = candidate.score;
  }

  if (!existing.reference && candidate.reference) {
    existing.reference = candidate.reference;
  }
}

function buildAgentInput(context: EntityClassificationContext): string {
  return [
    "Classify this suspect whisky entity row and decide the safest corrective action.",
    "Treat the JSON below as the authoritative local context.",
    "Context JSON:",
    "```json",
    JSON.stringify(context, null, 2),
    "```",
  ].join("\n");
}

export function createEntityClassifier(
  options: CreateEntityClassifierOptions,
): EntityClassifier {
  const runEntityClassifierAgent = async ({
    context,
  }: RunEntityClassifierAgentInput): Promise<EntityClassificationResult> => {
    if (options.overrides?.runEntityClassifierAgent) {
      return await options.overrides.runEntityClassifierAgent({ context });
    }

    const resolvedEntities = new Map<number, EntityResolution>();
    const searchEvidence: EntityClassificationArtifacts["searchEvidence"] = [];
    const instructions = buildEntityClassifierInstructions({
      hasEntitySearch: !!options.adapters.searchEntities,
      hasOpenAIWebSearch: options.maxSearchQueries > 0,
      maxSearchQueries: options.maxSearchQueries,
    });

    const tools = [
      ...(options.adapters.searchEntities
        ? [
            createSearchEntitiesTool({
              searchEntities: options.adapters.searchEntities,
              onResults: (results) => {
                for (const result of results) {
                  mergeResolvedEntity(
                    resolvedEntities,
                    EntityResolutionSchema.parse(result),
                  );
                }
              },
            }),
          ]
        : []),
      ...(options.maxSearchQueries > 0
        ? [
            createOpenAIWebSearchTool({
              client: options.client,
              maxSearchQueries: options.maxSearchQueries,
              model: options.model,
              onEvidence: (evidence) => {
                searchEvidence.push(evidence);
              },
            }),
          ]
        : []),
    ];

    const agent = new Agent({
      name: "entity_classifier_reasoner",
      instructions,
      model: options.model,
      modelSettings: {
        parallelToolCalls: false,
        ...getDeterministicOpenAISettings(options.model),
      },
      outputType: EntityClassificationAdviceSchema,
      tools,
    });
    const conversationId = `entity:${context.entity.id}`;
    const runner = new Runner({
      tracingDisabled: true,
      modelProvider: new OpenAIProvider({
        openAIClient: options.client,
        useResponses: true,
      }),
      workflowName: "Entity Classifier",
      groupId: conversationId,
      traceMetadata: {
        "gen_ai.conversation.id": conversationId,
        entity_id: `${context.entity.id}`,
      },
    });

    try {
      const result = await startAgentSpan({
        name: "Entity Classifier",
        conversationId,
        attributes: {
          "gen_ai.request.model": options.model,
          "entity_classifier.entity_id": `${context.entity.id}`,
          "entity_classifier.entity_name": context.entity.name,
        },
        callback: async () =>
          await runner.run(agent, buildAgentInput(context), {
            maxTurns: ENTITY_CLASSIFIER_MAX_TURNS,
          }),
      });
      if (!result.finalOutput) {
        throw new Error("Agent returned empty output");
      }

      const artifacts = buildEntityClassificationArtifacts({
        resolvedEntities: Array.from(resolvedEntities.values()).sort(
          (left, right) => (right.score ?? 0) - (left.score ?? 0),
        ),
        searchEvidence,
      });
      const advice = finalizeEntityClassification({
        context,
        advice: EntityClassificationAdviceSchema.parse(result.finalOutput),
        artifacts,
      });

      return EntityClassificationResultSchema.parse({
        advice,
        artifacts,
      });
    } catch (error) {
      throw new EntityClassificationError(
        error instanceof Error
          ? error.message
          : "Unknown entity classification error",
        buildEntityClassificationArtifacts({
          resolvedEntities: Array.from(resolvedEntities.values()).sort(
            (left, right) => (right.score ?? 0) - (left.score ?? 0),
          ),
          searchEvidence,
        }),
        {
          cause: error,
        },
      );
    }
  };

  async function classifyEntity(
    input: ClassifyEntityInput,
  ): Promise<EntityClassificationResult> {
    const parsedInput = ClassifyEntityInputSchema.parse(input);
    return await runEntityClassifierAgent({
      context: parsedInput.context,
    });
  }

  return {
    classifyEntity,
    runEntityClassifierAgent,
  };
}
