import type {
  AuditBottleInput,
  BottleClassificationResult,
  BottleReference,
  ClassifyBottleReferenceInput,
} from "@peated/bottle-classifier/contract";
import {
  AuditBottleInputSchema,
  BottleCandidateSchema,
  createDecidedBottleClassification,
} from "@peated/bottle-classifier/contract";
import type { RunBottleClassifierAgentInput } from "@peated/bottle-classifier/internal/runtime";
import { createBottleClassifier } from "@peated/bottle-classifier/internal/runtime";
import {
  EntityResolutionSchema,
  SearchEntitiesArgsSchema,
  type SearchEntitiesArgs,
} from "@peated/bottle-classifier/internal/types";
import config from "@peated/server/config";
import { findBottleId } from "@peated/server/lib/bottleFinder";
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
import {
  getBottleClassifierContext,
  getEntityClassifierContext,
} from "./contextAdapters";

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
        await findBottleReferenceCandidates(
          {
            name: reference.name,
            bottleId: reference.currentBottleId ?? null,
          },
          extractedIdentity,
        ),
      searchBottles: searchBottleCandidates,
      getBottleCandidateById,
      getBottleContext: getBottleClassifierContext,
      getEntityContext: getEntityClassifierContext,
      searchEntities: searchBottleClassifierEntities,
    },
  });

  return bottleClassifier;
}

export async function runBottleReference(input: ClassifyBottleReferenceInput) {
  const reference = normalizeReferenceForClassifier(input.reference);
  const conversationId = buildReferenceConversationId(
    "bottle_reference",
    reference,
    input.conversationId,
  );

  return await withReferenceConversation(conversationId, async () => {
    return await getBottleClassifier().runBottleReference({
      ...input,
      reference,
      conversationId,
    });
  });
}

export async function classifyBottleReference(
  input: ClassifyBottleReferenceInput,
) {
  return (await runBottleReference(input)).result;
}

export async function runBottleAudit(input: AuditBottleInput) {
  const parsedInput = AuditBottleInputSchema.parse(input);
  const conversationId = `bottle_audit:${parsedInput.bottleId}`;

  return await withReferenceConversation(conversationId, async () => {
    return await getBottleClassifier().runBottleAudit(parsedInput);
  });
}

export async function auditBottle(input: AuditBottleInput) {
  return (await runBottleAudit(input)).result;
}

async function identifyExactAliasReference({
  input,
}: {
  input: ClassifyBottleReferenceInput;
}): Promise<BottleClassificationResult | null> {
  const bottleId = await findBottleId(input.reference.name);
  if (bottleId === null) {
    return null;
  }

  const candidate = await getBottleCandidateById(bottleId);
  if (!candidate) {
    return null;
  }

  return createDecidedBottleClassification({
    decision: {
      action: "match",
      rationale:
        "Stored bottle alias exactly matched the extracted label reference.",
      candidateBottleIds: [bottleId],
      identityScope: "product",
      observation: null,
      identityBasis: {
        bottleTraits: ["literal stored alias"],
        releaseTraits: [],
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
      matchedBottleId: bottleId,
      proposedBottle: null,
    },
    artifacts: {
      extractedIdentity: input.extractedIdentity ?? null,
      imageEvidence: input.imageEvidence ?? null,
      candidates: [
        BottleCandidateSchema.parse({
          ...candidate,
          source: Array.from(new Set([...candidate.source, "exact"])),
        }),
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
      proposedBottle: null,
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
  const conversationId = buildReferenceConversationId(
    "bottle_identifier",
    reference,
    input.conversationId,
  );
  const normalizedInput = {
    ...input,
    conversationId,
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
