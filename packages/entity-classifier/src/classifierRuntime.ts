import { Agent, OpenAIProvider, Runner } from "@openai/agents";
import type OpenAI from "openai";
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
import {
  EntityClassificationDecisionSchema,
  EntityResolutionSchema,
  SearchEntitiesArgsSchema,
  type EntityClassificationDecision,
  type EntityClassificationReference,
  type EntityResolution,
  type SearchEntitiesArgs,
} from "./classifierTypes";
import { getDeterministicOpenAISettings } from "./openaiModelSettings";
import { createOpenAIWebSearchTool, createSearchEntitiesTool } from "./tools";

const ENTITY_CLASSIFIER_MAX_TURNS = 8;

export type RunEntityClassifierAgentInput = {
  reference: EntityClassificationReference;
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

  if (!existing.alias && candidate.alias) {
    existing.alias = candidate.alias;
  }
}

function buildAgentInput(reference: EntityClassificationReference): string {
  return [
    "Classify this suspect whisky entity row and decide the safest corrective action.",
    "Treat the JSON below as the authoritative local context.",
    "Reference JSON:",
    "```json",
    JSON.stringify(reference, null, 2),
    "```",
  ].join("\n");
}

export function createEntityClassifier(
  options: CreateEntityClassifierOptions,
): EntityClassifier {
  const runEntityClassifierAgent = async ({
    reference,
  }: RunEntityClassifierAgentInput): Promise<EntityClassificationResult> => {
    if (options.overrides?.runEntityClassifierAgent) {
      return await options.overrides.runEntityClassifierAgent({ reference });
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
      outputType: EntityClassificationDecisionSchema,
      tools,
    });
    const runner = new Runner({
      modelProvider: new OpenAIProvider({
        openAIClient: options.client,
        useResponses: true,
      }),
      workflowName: "Entity Classifier",
      groupId: `entity:${reference.entity.id}`,
      traceMetadata: {
        entity_id: `${reference.entity.id}`,
      },
    });

    try {
      const result = await runner.run(agent, buildAgentInput(reference), {
        maxTurns: ENTITY_CLASSIFIER_MAX_TURNS,
      });
      if (!result.finalOutput) {
        throw new Error("Agent returned empty output");
      }

      return EntityClassificationResultSchema.parse({
        decision: EntityClassificationDecisionSchema.parse(
          result.finalOutput as EntityClassificationDecision,
        ),
        artifacts: buildEntityClassificationArtifacts({
          resolvedEntities: Array.from(resolvedEntities.values()).sort(
            (left, right) => (right.score ?? 0) - (left.score ?? 0),
          ),
          searchEvidence,
        }),
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
      reference: parsedInput.reference,
    });
  }

  return {
    classifyEntity,
    runEntityClassifierAgent,
  };
}
