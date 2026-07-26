import { normalizeProposedBottleDraft } from "@peated/bottle-classifier/bottleCreationDrafts";
import { db } from "@peated/server/db";
import {
  type Bottle,
  type ExternalSite,
  type StorePrice,
  type StorePriceMatchProposal,
  bottles,
} from "@peated/server/db/schema";
import { hasActiveStorePriceMatchProposalProcessingLease } from "@peated/server/lib/priceMatching";
import { getStorePriceMatchAutomationAssessment } from "@peated/server/lib/priceMatchingAutomation";
import { type Context } from "@peated/server/orpc/context";
import {
  ExtractedBottleDetailsSchema,
  PriceMatchCandidateSchema,
  PriceMatchSearchEvidenceSchema,
  ProposedBottleSchema,
  ProposedReleaseSchema,
  StorePriceMatchAutomationAssessmentSchema,
  StorePriceMatchProposalSchema,
  StorePriceMatchQueueItemSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { StorePriceWithSiteSerializer } from "@peated/server/serializers/storePrice";
import { inArray } from "drizzle-orm";

type QueueRow = {
  isProcessing?: boolean;
  proposal: StorePriceMatchProposal;
  price: StorePrice & { externalSite: ExternalSite };
};

type StructuredAutomationIssue = {
  code?: unknown;
  format?: unknown;
  message?: unknown;
  path?: unknown;
};

function normalizeStoredProposedBottle(
  proposedBottle: unknown,
): ReturnType<typeof ProposedBottleSchema.parse> {
  return {
    ...normalizeProposedBottleDraft(ProposedBottleSchema.parse(proposedBottle)),
    caskType: null,
    caskSize: null,
    caskFill: null,
  };
}

function getPersistedAutomationAssessment(proposal: StorePriceMatchProposal) {
  if (!proposal.automationAssessment) {
    return null;
  }
  if (!("plainAgeBottleAutoVerifyEligible" in proposal.automationAssessment)) {
    return null;
  }

  const parsedAssessment = StorePriceMatchAutomationAssessmentSchema.safeParse(
    proposal.automationAssessment,
  );

  return parsedAssessment.success ? parsedAssessment.data : null;
}

function humanizeAutomationIssuePath(path: unknown): string | null {
  const rawParts = Array.isArray(path)
    ? path.filter((segment): segment is string => typeof segment === "string")
    : typeof path === "string"
      ? path.split(".").filter(Boolean)
      : [];

  if (rawParts.length === 0) {
    return null;
  }

  return rawParts
    .map((part) =>
      part
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .split(" ")
        .map((word) =>
          word.toLowerCase() === "url" ? "URL" : word.toLowerCase(),
        )
        .join(" "),
    )
    .join(" ");
}

function formatStructuredAutomationIssue(
  issue: StructuredAutomationIssue,
): string | null {
  const path = humanizeAutomationIssuePath(issue.path);
  const message =
    typeof issue.message === "string" && issue.message.length > 0
      ? issue.message
      : null;

  if (issue.code === "invalid_format" && issue.format === "url") {
    return path ? `${path} is invalid` : "URL is invalid";
  }

  if (!message) {
    return null;
  }

  return path ? `${path}: ${message}` : message;
}

function getAutomationBlockersFromError(error: string): string[] {
  const trimmedError = error.trim();
  if (!trimmedError.startsWith("[") || !trimmedError.endsWith("]")) {
    return [error];
  }

  try {
    const parsedIssues = JSON.parse(trimmedError);
    if (!Array.isArray(parsedIssues)) {
      return [error];
    }

    const formattedIssues = parsedIssues
      .map((issue) =>
        issue && typeof issue === "object"
          ? formatStructuredAutomationIssue(issue)
          : null,
      )
      .filter((issue): issue is string => !!issue);

    return formattedIssues.length > 0 ? formattedIssues : [error];
  } catch {
    return [error];
  }
}

export async function serializeQueueItems(
  rows: QueueRow[],
  context: Context,
  readContext: {
    caller: string;
    operation: string;
  },
) {
  void readContext;
  const bottleIds = Array.from(
    new Set(
      rows.flatMap(({ proposal }) =>
        [
          proposal.currentBottleId,
          proposal.suggestedBottleId,
          proposal.parentBottleId,
        ].filter((id): id is number => id !== null),
      ),
    ),
  );
  const bottleList: Bottle[] = bottleIds.length
    ? await db.query.bottles.findMany({
        where: inArray(bottles.id, bottleIds),
        with: {
          brand: true,
          bottler: true,
          series: true,
        },
      })
    : [];
  const bottlesById = Object.fromEntries(
    (
      await serialize(BottleSerializer, bottleList, context.user, [
        "description",
        "tastingNotes",
      ])
    ).map((item, index) => [bottleList[index].id, item]),
  );

  const prices = await serialize(
    StorePriceWithSiteSerializer,
    rows.map((row) => row.price),
    context.user,
  );

  return rows.map((row, index) => {
    return StorePriceMatchQueueItemSchema.parse({
      ...serializeProposal(row.proposal, {
        isProcessing: row.isProcessing,
        price: row.price,
      }),
      price: prices[index],
      currentBottle: row.proposal.currentBottleId
        ? (bottlesById[row.proposal.currentBottleId] ?? null)
        : null,
      suggestedBottle: row.proposal.suggestedBottleId
        ? (bottlesById[row.proposal.suggestedBottleId] ?? null)
        : null,
      parentBottle: row.proposal.parentBottleId
        ? (bottlesById[row.proposal.parentBottleId] ?? null)
        : null,
    });
  });
}

export function serializeProposal(
  proposal: StorePriceMatchProposal,
  {
    isProcessing,
    price,
  }: {
    isProcessing?: boolean;
    price?: StorePrice & { externalSite: ExternalSite };
  } = {},
) {
  const candidateBottles = PriceMatchCandidateSchema.array().parse(
    proposal.candidateBottles,
  );
  const extractedLabel = proposal.extractedLabel
    ? ExtractedBottleDetailsSchema.parse(proposal.extractedLabel)
    : null;
  const normalizedProposedBottle = proposal.proposedBottle
    ? normalizeStoredProposedBottle(proposal.proposedBottle)
    : null;
  const proposedRelease = proposal.proposedRelease
    ? ProposedReleaseSchema.parse(proposal.proposedRelease)
    : null;
  const searchEvidence = PriceMatchSearchEvidenceSchema.array().parse(
    proposal.searchEvidence,
  );
  const automationAssessment =
    getPersistedAutomationAssessment(proposal) ??
    (price
      ? getStorePriceMatchAutomationAssessment({
          action: proposal.proposalType,
          modelConfidence: proposal.confidence,
          price,
          suggestedBottleId: proposal.suggestedBottleId,
          suggestedReleaseId: proposal.suggestedReleaseId,
          candidateBottles,
          extractedLabel,
          proposedBottle: normalizedProposedBottle,
          proposedRelease,
          creationTarget: proposal.creationTarget,
          searchEvidence,
        })
      : {
          modelConfidence: proposal.confidence,
          automationScore: null,
          automationEligible: false,
          automationBlockers: [],
          decisiveMatchAttributes: [],
          plainAgeBottleAutoVerifyEligible: false,
          differentiatingAttributes: [],
          webEvidenceChecks: [],
        });
  const automationBlockers =
    proposal.status === "errored" && proposal.error
      ? [
          ...automationAssessment.automationBlockers,
          ...getAutomationBlockersFromError(proposal.error),
        ]
      : automationAssessment.automationBlockers;
  const serializedProposal = StorePriceMatchProposalSchema.parse({
    id: proposal.id,
    status: proposal.status,
    proposalType: proposal.proposalType,
    confidence: proposal.confidence,
    modelConfidence: automationAssessment.modelConfidence,
    automationScore: automationAssessment.automationScore,
    automationEligible: automationAssessment.automationEligible,
    automationBlockers: Array.from(new Set(automationBlockers)),
    decisiveMatchAttributes: automationAssessment.decisiveMatchAttributes,
    plainAgeBottleAutoVerifyEligible:
      automationAssessment.plainAgeBottleAutoVerifyEligible,
    differentiatingAttributes: automationAssessment.differentiatingAttributes,
    webEvidenceChecks: automationAssessment.webEvidenceChecks,
    parentBottleId: proposal.parentBottleId,
    creationTarget: proposal.creationTarget,
    candidateBottles,
    extractedLabel,
    proposedBottle: normalizedProposedBottle,
    proposedRelease,
    searchEvidence,
    rationale: proposal.rationale,
    model: proposal.model,
    error: proposal.error,
    lastEvaluatedAt: proposal.lastEvaluatedAt
      ? proposal.lastEvaluatedAt.toISOString()
      : null,
    reviewedAt: proposal.reviewedAt ? proposal.reviewedAt.toISOString() : null,
    isProcessing:
      isProcessing ?? hasActiveStorePriceMatchProposalProcessingLease(proposal),
    processingQueuedAt: proposal.processingQueuedAt
      ? proposal.processingQueuedAt.toISOString()
      : null,
    processingExpiresAt: proposal.processingExpiresAt
      ? proposal.processingExpiresAt.toISOString()
      : null,
    createdAt: proposal.createdAt.toISOString(),
    updatedAt: proposal.updatedAt.toISOString(),
  });

  return {
    ...serializedProposal,
    proposedBottle: serializedProposal.proposedBottle,
  };
}
