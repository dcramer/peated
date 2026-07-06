import type {
  BottleClassificationResult,
  BottleReference,
  ClassifyBottleReferenceInput,
} from "@peated/bottle-classifier/contract";
import { createDecidedBottleClassification } from "@peated/bottle-classifier/contract";
import type { RunBottleClassifierAgentInput } from "@peated/bottle-classifier/internal/runtime";
import { createBottleClassifier } from "@peated/bottle-classifier/internal/runtime";
import {
  BottleCandidateSchema,
  EntityResolutionSchema,
  SearchEntitiesArgsSchema,
  type BottleCandidate,
  type SearchEntitiesArgs,
} from "@peated/bottle-classifier/internal/types";
import config from "@peated/server/config";
import { findBottleTarget } from "@peated/server/lib/bottleFinder";
import {
  findBottleReferenceCandidates,
  getBottleCandidateById,
  searchBottleCandidates,
} from "@peated/server/lib/bottleReferenceCandidates";
import { searchClassifierEntities } from "@peated/server/lib/classifierEntitySearch";
import {
  createOpenAIClient,
  withSentryConversation,
} from "@peated/server/lib/openaiClient";
import { absoluteUrl } from "@peated/server/lib/urls";
import { randomUUID } from "node:crypto";

let bottleClassifier: ReturnType<typeof createBottleClassifier> | null = null;

function withoutCaskFields(value: Record<string, unknown>) {
  const {
    caskType: _caskType,
    caskSize: _caskSize,
    caskFill: _caskFill,
    ...rest
  } = value;
  return rest;
}

function withoutExtractedCaskFields<T extends object>(
  value: T | null | undefined,
) {
  if (value === null || value === undefined) {
    return null;
  }

  const {
    cask_type: _caskType,
    cask_size: _caskSize,
    cask_fill: _caskFill,
    ...rest
  } = value as T & {
    cask_type?: unknown;
    cask_size?: unknown;
    cask_fill?: unknown;
  };

  return rest;
}

function withoutCaskTraitFields(value: unknown) {
  return value !== "caskType" && value !== "caskSize" && value !== "caskFill";
}

function toClassifierCandidate(candidate: unknown): BottleCandidate {
  const { familyContext, ...rest } = withoutCaskFields(
    candidate as Record<string, unknown>,
  );
  const normalizedFamilyContext =
    familyContext && typeof familyContext === "object"
      ? {
          ...(familyContext as Record<string, unknown>),
          parentBottleReleaseTraits: (
            ((familyContext as Record<string, unknown>)
              .parentBottleReleaseTraits as unknown[]) ?? []
          ).filter(withoutCaskTraitFields),
          siblingReleases: (
            ((familyContext as Record<string, unknown>)
              .siblingReleases as unknown[]) ?? []
          ).map((sibling) => {
            const siblingRest = withoutCaskFields(
              sibling as Record<string, unknown>,
            );
            return {
              ...siblingRest,
              traitFields: (
                (siblingRest.traitFields as unknown[]) ?? []
              ).filter(withoutCaskTraitFields),
            };
          }),
          siblingBottles: (
            ((familyContext as Record<string, unknown>)
              .siblingBottles as unknown[]) ?? []
          ).map((sibling) => {
            const siblingRest = withoutCaskFields(
              sibling as Record<string, unknown>,
            );
            return {
              ...siblingRest,
              traitFields: (
                (siblingRest.traitFields as unknown[]) ?? []
              ).filter(withoutCaskTraitFields),
            };
          }),
        }
      : familyContext;

  return BottleCandidateSchema.parse({
    ...rest,
    familyContext: normalizedFamilyContext,
  });
}

function toClassifierCandidates(candidates: unknown[]): BottleCandidate[] {
  return candidates.map(toClassifierCandidate);
}

function withLegacyCaskIdentityDefaults<T extends object>(identity: T | null) {
  return identity === null
    ? null
    : {
        ...identity,
        cask_type: null,
        cask_size: null,
        cask_fill: null,
      };
}

async function searchBottleClassifierEntities(args: SearchEntitiesArgs) {
  const parsedArgs = SearchEntitiesArgsSchema.parse(args);
  return (await searchClassifierEntities(parsedArgs)).map((result) =>
    EntityResolutionSchema.parse(result),
  );
}

function normalizeReferenceForClassifier(
  reference: BottleReference,
): BottleReference {
  if (!reference.imageUrl) {
    return reference;
  }

  return {
    ...reference,
    imageUrl: absoluteUrl(config.API_SERVER, reference.imageUrl),
  };
}

function buildReferenceConversationId(
  prefix: string,
  reference: BottleReference,
  conversationId?: string,
) {
  const explicitConversationId = conversationId?.trim();
  if (explicitConversationId) {
    return explicitConversationId;
  }

  const id =
    reference.id === undefined || reference.id === null || reference.id === ""
      ? randomUUID()
      : reference.id;

  return `${prefix}:${id}`;
}

async function withReferenceConversation<T>(
  conversationId: string,
  callback: () => Promise<T>,
) {
  return await withSentryConversation(conversationId, callback);
}

export function getBottleClassifier() {
  if (bottleClassifier) {
    return bottleClassifier;
  }

  const client = createOpenAIClient();

  bottleClassifier = createBottleClassifier({
    client,
    model: config.OPENAI_MODEL,
    maxSearchQueries: config.BOTTLE_CLASSIFIER_MAX_SEARCH_QUERIES,
    firecrawlApiKey: config.FIRECRAWL_API_KEY,
    firecrawlApiUrl: config.FIRECRAWL_API_URL,
    adapters: {
      findInitialCandidates: async ({ reference, extractedIdentity }) =>
        toClassifierCandidates(
          await findBottleReferenceCandidates(
            {
              name: reference.name,
              bottleId: reference.currentBottleId ?? null,
              releaseId: reference.currentReleaseId ?? null,
            },
            withLegacyCaskIdentityDefaults(extractedIdentity),
          ),
        ),
      searchBottles: async (args) =>
        toClassifierCandidates(await searchBottleCandidates(args)),
      getBottleCandidateById: async (bottleId, releaseId) => {
        const candidate = await getBottleCandidateById(bottleId, releaseId);
        return candidate ? toClassifierCandidate(candidate) : null;
      },
      searchEntities: searchBottleClassifierEntities,
    },
  });

  return bottleClassifier;
}

export async function classifyBottleReference(
  input: ClassifyBottleReferenceInput,
) {
  const reference = normalizeReferenceForClassifier(input.reference);
  const conversationId = buildReferenceConversationId(
    "bottle_reference",
    reference,
    input.conversationId,
  );

  return await withReferenceConversation(conversationId, async () => {
    return await getBottleClassifier().classifyBottleReference({
      ...input,
      reference,
      conversationId,
    });
  });
}

async function identifyExactAliasReference({
  input,
}: {
  input: ClassifyBottleReferenceInput;
}): Promise<BottleClassificationResult | null> {
  const target = await findBottleTarget(input.reference.name);
  if (!target) {
    return null;
  }

  const candidate = await getBottleCandidateById(
    target.bottleId,
    target.releaseId,
  );
  if (!candidate) {
    return null;
  }

  return createDecidedBottleClassification({
    decision: {
      action: "match",
      rationale:
        "Stored bottle alias exactly matched the extracted label reference.",
      candidateBottleIds: [target.bottleId],
      identityScope: "product",
      observation: null,
      identityBasis: {
        bottleTraits: ["literal stored alias"],
        releaseTraits:
          target.releaseId === null ? [] : ["literal stored alias"],
        observationTraits: [],
        yearInterpretation: "none",
        siblingEvidence: "none",
        uncertainties: [],
      },
      confidenceBasis: {
        positiveEvidence: [
          "The normalized extracted reference exactly matched one non-ignored stored bottle alias.",
        ],
        unresolvedRisks: [],
        toolsUsed: ["initial_local_candidates"],
        webEvidence: "not_needed",
      },
      matchedBottleId: target.bottleId,
      matchedReleaseId: target.releaseId,
      parentBottleId: null,
      proposedBottle: null,
      proposedRelease: null,
    },
    artifacts: {
      extractedIdentity: withoutExtractedCaskFields(input.extractedIdentity),
      imageEvidence: input.imageEvidence ?? null,
      candidates: [
        {
          ...toClassifierCandidate(candidate),
          source: Array.from(new Set([...candidate.source, "exact"])),
        },
      ],
      searchEvidence: [],
      resolvedEntities: [],
    },
  });
}

function createLocalIdentificationNoMatch(
  input: ClassifyBottleReferenceInput,
): BottleClassificationResult {
  return createDecidedBottleClassification({
    decision: {
      action: "no_match",
      rationale: "Local identification did not find an exact alias match.",
      candidateBottleIds: [],
      identityScope: "product",
      observation: null,
      identityBasis: null,
      confidenceBasis: {
        positiveEvidence: [],
        unresolvedRisks: [
          {
            category: "other",
            note: "No local identification agent is configured.",
          },
        ],
        toolsUsed: ["none"],
        webEvidence: "not_used",
      },
      matchedBottleId: null,
      matchedReleaseId: null,
      parentBottleId: null,
      proposedBottle: null,
      proposedRelease: null,
    },
    artifacts: {
      extractedIdentity: withoutExtractedCaskFields(input.extractedIdentity),
      imageEvidence: input.imageEvidence ?? null,
      candidates: [],
      searchEvidence: [],
      resolvedEntities: [],
    },
  });
}

export async function identifyExistingBottleReference(
  input: ClassifyBottleReferenceInput,
  options: {
    allowExactAliasPreflight?: boolean;
  } = {},
) {
  const reference = normalizeReferenceForClassifier(input.reference);
  const conversationId = buildReferenceConversationId(
    "bottle_identifier",
    reference,
    input.conversationId,
  );
  const normalizedInput = {
    ...input,
    conversationId,
    extractedIdentity: withoutExtractedCaskFields(input.extractedIdentity),
    reference,
  };

  return await withReferenceConversation(conversationId, async () => {
    if (options.allowExactAliasPreflight !== false) {
      const exactAliasClassification = await identifyExactAliasReference({
        input: normalizedInput,
      });
      if (exactAliasClassification) {
        return exactAliasClassification;
      }
    }

    if (!config.OPENAI_API_KEY) {
      return createLocalIdentificationNoMatch(normalizedInput);
    }

    return await getBottleClassifier().identifyExistingBottleReference(
      normalizedInput,
    );
  });
}

export async function runBottleClassifierAgent(
  input: RunBottleClassifierAgentInput,
) {
  const reference = normalizeReferenceForClassifier(input.reference);
  const conversationPrefix =
    input.instructionMode === "local_identification"
      ? "bottle_identifier"
      : "bottle_reference";
  const conversationId = buildReferenceConversationId(
    conversationPrefix,
    reference,
    input.conversationId,
  );

  return await withReferenceConversation(conversationId, async () => {
    return await getBottleClassifier().runBottleClassifierAgent({
      ...input,
      reference,
      conversationId,
    });
  });
}
