import { normalizeProposedBottleDraft } from "@peated/bottle-classifier/bottleCreationDrafts";
import {
  BottleCandidateSchema as ClassifierBottleCandidateSchema,
  BottleExtractedDetailsSchema as ClassifierBottleExtractedDetailsSchema,
  type BottleCandidate,
} from "@peated/bottle-classifier/internal/types";
import { db } from "@peated/server/db";
import {
  bottleChecks,
  bottleOperations,
  bottles,
  type Bottle,
  type ExternalSite,
  type StorePrice,
  type StorePriceMatchProposal,
} from "@peated/server/db/schema";
import { logWarn } from "@peated/server/lib/log";
import { hasActiveStorePriceMatchProposalProcessingLease } from "@peated/server/lib/priceMatching";
import { getStorePriceMatchAutomationAssessment } from "@peated/server/lib/priceMatchingAutomation";
import { type Context } from "@peated/server/orpc/context";
import {
  ExtractedBottleDetailsSchema,
  PriceMatchCandidateSchema,
  PriceMatchSearchEvidenceSchema,
  ProposedBottleSchema,
  StorePriceMatchAutomationAssessmentSchema,
  StorePriceMatchProposalSchema,
  StorePriceMatchQueueItemSchema,
} from "@peated/server/schemas";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { StorePriceWithSiteSerializer } from "@peated/server/serializers/storePrice";
import { desc, inArray } from "drizzle-orm";
import { SUPPLEMENTAL_WORK_STATUSES } from "./filters";

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

type LinkedBottleCheck = {
  id: number;
  output: Record<string, unknown> | null;
  closedAt: Date | null;
  storePriceMatchProposalId: number | null;
};

function checkHasFindings(check: LinkedBottleCheck): boolean {
  return (
    Array.isArray(check.output?.findings) && check.output.findings.length > 0
  );
}

async function getLinkedBottleCheckIds(
  proposals: StorePriceMatchProposal[],
): Promise<Map<number, number[]>> {
  if (proposals.length === 0) {
    return new Map();
  }

  const proposalIds = proposals.map(({ id }) => id);
  const checks = await db
    .select({
      id: bottleChecks.id,
      output: bottleChecks.output,
      closedAt: bottleChecks.closedAt,
      storePriceMatchProposalId: bottleChecks.storePriceMatchProposalId,
    })
    .from(bottleChecks)
    .where(inArray(bottleChecks.storePriceMatchProposalId, proposalIds))
    .orderBy(desc(bottleChecks.createdAt), desc(bottleChecks.id));
  if (checks.length === 0) {
    return new Map();
  }

  const operations = await db
    .select({
      checkId: bottleOperations.checkId,
      status: bottleOperations.status,
    })
    .from(bottleOperations)
    .where(
      inArray(
        bottleOperations.checkId,
        checks.map(({ id }) => id),
      ),
    );
  const supplementalWorkStatuses = new Set<string>(SUPPLEMENTAL_WORK_STATUSES);
  const checksWithSupplementalWork = new Set(
    operations
      .filter(({ status }) => supplementalWorkStatuses.has(status))
      .map(({ checkId }) => checkId),
  );
  const checksByProposalId = Map.groupBy(
    checks.filter(
      (
        check,
      ): check is LinkedBottleCheck & {
        storePriceMatchProposalId: number;
      } => check.storePriceMatchProposalId !== null,
    ),
    ({ storePriceMatchProposalId }) => storePriceMatchProposalId,
  );

  return new Map(
    proposals.map((proposal) => {
      const openChecks = (checksByProposalId.get(proposal.id) ?? []).filter(
        ({ closedAt }) => closedAt === null,
      );
      const supplementalChecks = openChecks.filter(
        (check) =>
          checkHasFindings(check) || checksWithSupplementalWork.has(check.id),
      );
      const primaryNeedsDisposition =
        proposal.status === "pending_review" || proposal.status === "errored";
      const visibleChecks = primaryNeedsDisposition
        ? [openChecks[0], ...supplementalChecks]
        : supplementalChecks;

      return [
        proposal.id,
        Array.from(
          new Set(visibleChecks.flatMap((check) => (check ? [check.id] : []))),
        ),
      ];
    }),
  );
}

/**
 * Stored queue snapshots are untrusted JSON. Only current direct-Bottle
 * candidates are returned to the queue.
 */
function normalizeStoredPriceMatchCandidates(
  value: unknown,
  proposalId: number,
) {
  const candidates = Array.isArray(value) ? value : [];
  const normalized: BottleCandidate[] = [];
  let discarded = Array.isArray(value) ? 0 : 1;

  for (const candidate of candidates) {
    const direct = PriceMatchCandidateSchema.safeParse(candidate);
    if (direct.success) {
      normalized.push(direct.data);
    } else {
      discarded += 1;
    }
  }

  if (discarded > 0) {
    logWarn("Discarded invalid price-match candidate evidence", {
      extra: {
        proposalId,
        discardedCandidates: discarded,
      },
    });
  }

  return normalized;
}

function normalizeStoredProposedBottle(
  proposedBottle: unknown,
): ReturnType<typeof ProposedBottleSchema.parse> {
  return normalizeProposedBottleDraft(
    ProposedBottleSchema.parse(proposedBottle),
  );
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
  const linkedBottleCheckIds = await getLinkedBottleCheckIds(
    rows.map(({ proposal }) => proposal),
  );
  const bottleIds = Array.from(
    new Set(
      rows.flatMap(({ proposal }) =>
        [proposal.currentBottleId, proposal.suggestedBottleId].filter(
          (id): id is number => id !== null,
        ),
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
      bottleCheckIds: linkedBottleCheckIds.get(row.proposal.id) ?? [],
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
  const candidateBottles = normalizeStoredPriceMatchCandidates(
    proposal.candidateBottles,
    proposal.id,
  );
  const extractedLabel = proposal.extractedLabel
    ? ExtractedBottleDetailsSchema.parse(proposal.extractedLabel)
    : null;
  const normalizedProposedBottle = proposal.proposedBottle
    ? normalizeStoredProposedBottle(proposal.proposedBottle)
    : null;
  const searchEvidence = PriceMatchSearchEvidenceSchema.array().parse(
    proposal.searchEvidence,
  );
  const classifierCandidates =
    ClassifierBottleCandidateSchema.array().safeParse(candidateBottles);
  const classifierExtractedLabel =
    ClassifierBottleExtractedDetailsSchema.nullable().safeParse(extractedLabel);
  const automationAssessment =
    getPersistedAutomationAssessment(proposal) ??
    (price && classifierCandidates.success && classifierExtractedLabel.success
      ? getStorePriceMatchAutomationAssessment({
          action: proposal.proposalType,
          modelConfidence: proposal.confidence,
          price,
          suggestedBottleId: proposal.suggestedBottleId,
          candidateBottles: classifierCandidates.data,
          extractedLabel: classifierExtractedLabel.data,
          proposedBottle: normalizedProposedBottle,
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
    candidateBottles,
    extractedLabel,
    proposedBottle: normalizedProposedBottle,
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
