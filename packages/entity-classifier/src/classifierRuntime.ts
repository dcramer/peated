import { agentOutput, runAgent } from "@peated/agent-run";
import type { LanguageModel } from "ai";
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
import { startClassifierRunSpan } from "./observability";
import { getDeterministicOpenAISettings } from "./openaiModelSettings";
import { finalizeEntityClassification } from "./reviewPolicy";
import {
  MAX_PAGE_READS,
  createSearchEntitiesTool,
  createWebTools,
  type EntityClassifierWeb,
} from "./tools";

const ENTITY_CLASSIFIER_MAX_TURNS = 8;
const EntityClassifierOutput = agentOutput(
  "entity_classification_advice",
  EntityClassificationAdviceSchema,
);

export type RunEntityClassifierAgentInput = {
  context: EntityClassificationContext;
};

export type EntityClassifierAdapters = {
  searchEntities?: (args: SearchEntitiesArgs) => Promise<EntityResolution[]>;
};

export type CreateEntityClassifierOptions = {
  languageModel: (modelId: string) => LanguageModel;
  model: string;
  maxSearchQueries: number;
  /** PeatedBot, or null to run without the web. */
  web: EntityClassifierWeb | null;
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
    const web = options.maxSearchQueries > 0 ? options.web : null;
    const instructions = buildEntityClassifierInstructions({
      hasEntitySearch: !!options.adapters.searchEntities,
      hasWebTools: !!web,
      maxSearchQueries: options.maxSearchQueries,
      maxPageReads: MAX_PAGE_READS,
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
      ...(web
        ? createWebTools({
            web,
            maxSearchQueries: options.maxSearchQueries,
            onEvidence: (evidence) => {
              searchEvidence.push(evidence);
            },
          })
        : []),
    ];

    const conversationId = `entity:${context.entity.id}`;

    try {
      const result = await startClassifierRunSpan({
        name: "Entity Classifier",
        conversationId,
        attributes: {
          "entity_classifier.entity_id": `${context.entity.id}`,
          "entity_classifier.entity_name": context.entity.name,
        },
        callback: async () =>
          await runAgent({
            model: options.languageModel(options.model),
            functionId: "entity_classifier",
            instructions,
            input: buildAgentInput(context),
            tools,
            output: EntityClassifierOutput,
            maxTurns: ENTITY_CLASSIFIER_MAX_TURNS,
            temperature: getDeterministicOpenAISettings(options.model)
              .temperature,
          }),
      });

      const artifacts = buildEntityClassificationArtifacts({
        resolvedEntities: Array.from(resolvedEntities.values()).sort(
          (left, right) => (right.score ?? 0) - (left.score ?? 0),
        ),
        searchEvidence,
      });
      const advice = finalizeEntityClassification({
        context,
        advice: EntityClassificationAdviceSchema.parse(result.output),
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
