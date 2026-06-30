import type {
  BottleClassificationResult,
  BottleReference,
  ClassifyBottleReferenceInput,
} from "@peated/bottle-classifier/contract";
import { createDecidedBottleClassification } from "@peated/bottle-classifier/contract";
import type { RunBottleClassifierAgentInput } from "@peated/bottle-classifier/internal/runtime";
import { createBottleClassifier } from "@peated/bottle-classifier/internal/runtime";
import {
  EntityResolutionSchema,
  SearchEntitiesArgsSchema,
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

let bottleClassifier: ReturnType<typeof createBottleClassifier> | null = null;

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
        await findBottleReferenceCandidates(
          {
            name: reference.name,
            bottleId: reference.currentBottleId ?? null,
            releaseId: reference.currentReleaseId ?? null,
          },
          extractedIdentity,
        ),
      searchBottles: searchBottleCandidates,
      getBottleCandidateById,
      searchEntities: searchBottleClassifierEntities,
    },
  });

  return bottleClassifier;
}

export async function classifyBottleReference(
  input: ClassifyBottleReferenceInput,
) {
  const reference = normalizeReferenceForClassifier(input.reference);
  const conversationId =
    reference.id === undefined || reference.id === null
      ? `bottle_classifier:${reference.name}`
      : `bottle_reference:${reference.id}`;

  return await withSentryConversation(conversationId, async () => {
    return await getBottleClassifier().classifyBottleReference({
      ...input,
      reference,
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
      confidence: 100,
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
        band: "auto_verification",
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
      extractedIdentity: input.extractedIdentity ?? null,
      imageEvidence: input.imageEvidence ?? null,
      candidates: [
        {
          ...candidate,
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
      confidence: 0,
      rationale: "Local identification did not find an exact alias match.",
      candidateBottleIds: [],
      identityScope: "product",
      observation: null,
      identityBasis: null,
      confidenceBasis: {
        band: "low",
        positiveEvidence: [],
        unresolvedRisks: ["No local identification agent is configured."],
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
      extractedIdentity: input.extractedIdentity ?? null,
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
  const normalizedInput = {
    ...input,
    reference,
  };
  const conversationId =
    reference.id === undefined || reference.id === null
      ? `bottle_identifier:${reference.name}`
      : `bottle_identifier:${reference.id}`;

  return await withSentryConversation(conversationId, async () => {
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
  const conversationId =
    reference.id === undefined || reference.id === null
      ? `bottle_classifier:${reference.name}`
      : `bottle_reference:${reference.id}`;

  return await withSentryConversation(conversationId, async () => {
    return await getBottleClassifier().runBottleClassifierAgent({
      ...input,
      reference,
    });
  });
}
