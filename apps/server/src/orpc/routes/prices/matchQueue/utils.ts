import { normalizeProposedBottleDraft } from "@peated/bottle-classifier/bottleCreationDrafts";
import {
  type Bottle,
  type BottleRelease,
  type ExternalSite,
  type StorePrice,
  type StorePriceMatchProposal,
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
  StorePriceMatchProposalSchema,
  StorePriceMatchQueueItemSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { BottleReleaseSerializer } from "@peated/server/serializers/bottleRelease";
import { StorePriceWithSiteSerializer } from "@peated/server/serializers/storePrice";

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
  {
    bottleList,
    releaseList,
  }: {
    bottleList: Bottle[];
    releaseList: BottleRelease[];
  },
  context: Context,
) {
  const bottlesById = Object.fromEntries(
    (
      await serialize(BottleSerializer, bottleList, context.user, [
        "description",
        "tastingNotes",
      ])
    ).map((item, index) => [bottleList[index].id, item]),
  );
  const releasesById = Object.fromEntries(
    (await serialize(BottleReleaseSerializer, releaseList, context.user)).map(
      (item, index) => [releaseList[index].id, item],
    ),
  );

  const prices = await serialize(
    StorePriceWithSiteSerializer,
    rows.map((row) => row.price),
    context.user,
  );

  return rows.map((row, index) =>
    StorePriceMatchQueueItemSchema.parse({
      ...serializeProposal(row.proposal, {
        isProcessing: row.isProcessing,
        price: row.price,
      }),
      price: prices[index],
      currentBottle: row.proposal.currentBottleId
        ? (bottlesById[row.proposal.currentBottleId] ?? null)
        : null,
      currentRelease: row.proposal.currentReleaseId
        ? (releasesById[row.proposal.currentReleaseId] ?? null)
        : null,
      suggestedBottle: row.proposal.suggestedBottleId
        ? (bottlesById[row.proposal.suggestedBottleId] ?? null)
        : null,
      suggestedRelease: row.proposal.suggestedReleaseId
        ? (releasesById[row.proposal.suggestedReleaseId] ?? null)
        : null,
      parentBottle: row.proposal.parentBottleId
        ? (bottlesById[row.proposal.parentBottleId] ?? null)
        : null,
    }),
  );
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
    ? normalizeProposedBottleDraft(
        ProposedBottleSchema.parse(proposal.proposedBottle),
      )
    : null;
  const proposedRelease = proposal.proposedRelease
    ? ProposedReleaseSchema.parse(proposal.proposedRelease)
    : null;
  const searchEvidence = PriceMatchSearchEvidenceSchema.array().parse(
    proposal.searchEvidence,
  );
  const automationAssessment = price
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
        differentiatingAttributes: [],
        webEvidenceChecks: [],
      };
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
    differentiatingAttributes: automationAssessment.differentiatingAttributes,
    webEvidenceChecks: automationAssessment.webEvidenceChecks,
    currentBottleId: proposal.currentBottleId,
    currentReleaseId: proposal.currentReleaseId,
    suggestedBottleId: proposal.suggestedBottleId,
    suggestedReleaseId: proposal.suggestedReleaseId,
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
