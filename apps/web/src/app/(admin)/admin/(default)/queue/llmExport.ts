import type { Outputs } from "@peated/server/orpc/router";

type QueueItem = Outputs["prices"]["matchQueue"]["list"]["results"][number];

type EntityLike = {
  id: number | null;
  name: string;
};

type SeriesLike = {
  id: number | null;
  name: string;
} | null;

type BottleLike = NonNullable<
  | QueueItem["currentBottle"]
  | QueueItem["suggestedBottle"]
  | QueueItem["parentBottle"]
>;

type ReleaseLike = NonNullable<
  QueueItem["currentRelease"] | QueueItem["suggestedRelease"]
>;

type ProposedBottleLike = NonNullable<QueueItem["proposedBottle"]>;
type ProposedReleaseLike = NonNullable<QueueItem["proposedRelease"]>;

function serializeEntity(value: EntityLike | null) {
  if (!value) {
    return null;
  }

  return {
    id: value.id,
    name: value.name,
  };
}

function serializeSeries(value: SeriesLike) {
  if (!value) {
    return null;
  }

  return {
    id: value.id,
    name: value.name,
  };
}

function serializeBottleIdentity(value: BottleLike | null) {
  if (!value) {
    return null;
  }

  return {
    id: value.id,
    fullName: value.fullName,
    name: value.name,
    brand: serializeEntity(value.brand),
    series: serializeSeries(value.series),
    category: value.category,
    distillers: value.distillers.map((distiller) => ({
      id: distiller.id,
      name: distiller.name,
    })),
    bottler: serializeEntity(value.bottler),
    edition: value.edition,
    statedAge: value.statedAge,
    abv: value.abv,
    caskStrength: value.caskStrength,
    singleCask: value.singleCask,
    vintageYear: value.vintageYear,
    releaseYear: value.releaseYear,
    caskType: value.caskType,
    caskSize: value.caskSize,
    caskFill: value.caskFill,
    imageUrl: value.imageUrl,
  };
}

function serializeReleaseIdentity(value: ReleaseLike | null) {
  if (!value) {
    return null;
  }

  return {
    id: value.id,
    bottleId: value.bottleId,
    fullName: value.fullName,
    name: value.name,
    edition: value.edition,
    statedAge: value.statedAge,
    abv: value.abv,
    caskStrength: value.caskStrength,
    singleCask: value.singleCask,
    vintageYear: value.vintageYear,
    releaseYear: value.releaseYear,
    caskType: value.caskType,
    caskSize: value.caskSize,
    caskFill: value.caskFill,
    imageUrl: value.imageUrl,
  };
}

function serializeProposedBottleDraft(value: ProposedBottleLike | null) {
  if (!value) {
    return null;
  }

  return {
    name: value.name,
    brand: serializeEntity(value.brand),
    series: serializeSeries(value.series),
    category: value.category,
    distillers: value.distillers.map((distiller) => ({
      id: distiller.id,
      name: distiller.name,
    })),
    bottler: serializeEntity(value.bottler),
    edition: value.edition,
    statedAge: value.statedAge,
    abv: value.abv,
    caskStrength: value.caskStrength,
    singleCask: value.singleCask,
    vintageYear: value.vintageYear,
    releaseYear: value.releaseYear,
    caskType: value.caskType,
    caskSize: value.caskSize,
    caskFill: value.caskFill,
  };
}

function serializeProposedReleaseDraft(value: ProposedReleaseLike | null) {
  if (!value) {
    return null;
  }

  return {
    edition: value.edition,
    statedAge: value.statedAge,
    abv: value.abv,
    caskStrength: value.caskStrength,
    singleCask: value.singleCask,
    vintageYear: value.vintageYear,
    releaseYear: value.releaseYear,
    caskType: value.caskType,
    caskSize: value.caskSize,
    caskFill: value.caskFill,
    imageUrl: value.imageUrl,
  };
}

export function formatPriceMatchQueueLlmExport(item: QueueItem) {
  return JSON.stringify(
    {
      schemaVersion: 1,
      source: "peated.admin.match_queue",
      proposal: {
        id: item.id,
        status: item.status,
        proposalType: item.proposalType,
        creationTarget: item.creationTarget,
        currentBottleId: item.currentBottleId,
        currentReleaseId: item.currentReleaseId,
        suggestedBottleId: item.suggestedBottleId,
        suggestedReleaseId: item.suggestedReleaseId,
        parentBottleId: item.parentBottleId,
        confidence: item.confidence,
        modelConfidence: item.modelConfidence,
        model: item.model,
        rationale: item.rationale,
        error: item.error,
        isProcessing: item.isProcessing,
        automation: {
          score: item.automationScore,
          eligible: item.automationEligible,
          blockers: item.automationBlockers,
          decisiveMatchAttributes: item.decisiveMatchAttributes,
          differentiatingAttributes: item.differentiatingAttributes,
        },
        timestamps: {
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          lastEvaluatedAt: item.lastEvaluatedAt,
          reviewedAt: item.reviewedAt,
          processingQueuedAt: item.processingQueuedAt,
          processingExpiresAt: item.processingExpiresAt,
        },
      },
      sourceListing: {
        id: item.price.id,
        name: item.price.name,
        price: item.price.price,
        currency: item.price.currency,
        volumeMl: item.price.volume,
        url: item.price.url,
        imageUrl: item.price.imageUrl,
        updatedAt: item.price.updatedAt,
        site: item.price.site
          ? {
              id: item.price.site.id,
              name: item.price.site.name,
              type: item.price.site.type,
            }
          : null,
      },
      extractedIdentity: item.extractedLabel,
      currentAssignment: {
        bottle: serializeBottleIdentity(item.currentBottle),
        release: serializeReleaseIdentity(item.currentRelease),
      },
      recommendation: {
        suggestedBottle: serializeBottleIdentity(item.suggestedBottle),
        suggestedRelease: serializeReleaseIdentity(item.suggestedRelease),
        parentBottle: serializeBottleIdentity(item.parentBottle),
        proposedBottleDraft: serializeProposedBottleDraft(item.proposedBottle),
        proposedReleaseDraft: serializeProposedReleaseDraft(
          item.proposedRelease,
        ),
      },
      artifacts: {
        localCandidates: item.candidateBottles.map((candidate) => ({
          kind: candidate.kind ?? null,
          bottleId: candidate.bottleId,
          releaseId: candidate.releaseId ?? null,
          alias: candidate.alias,
          fullName: candidate.fullName,
          bottleFullName: candidate.bottleFullName ?? null,
          brand: candidate.brand,
          bottler: candidate.bottler,
          series: candidate.series,
          distillery: candidate.distillery,
          category: candidate.category,
          statedAge: candidate.statedAge,
          edition: candidate.edition,
          caskStrength: candidate.caskStrength,
          singleCask: candidate.singleCask,
          abv: candidate.abv,
          vintageYear: candidate.vintageYear,
          releaseYear: candidate.releaseYear,
          caskType: candidate.caskType,
          caskSize: candidate.caskSize,
          caskFill: candidate.caskFill,
          score: candidate.score,
          source: candidate.source,
        })),
        webEvidenceChecks: item.webEvidenceChecks.map((check) => ({
          attribute: check.attribute,
          expectedValue: check.expectedValue,
          required: check.required,
          validated: check.validated,
          weaklySupported: check.weaklySupported,
          matchedSourceTiers: check.matchedSourceTiers,
          matchedSourceUrls: check.matchedSourceUrls,
        })),
        searchEvidence: item.searchEvidence.map((evidence) => ({
          provider: evidence.provider,
          query: evidence.query,
          summary: evidence.summary,
          results: evidence.results.map((result) => ({
            title: result.title,
            url: result.url,
            domain: result.domain,
            description: result.description,
            extraSnippets: result.extraSnippets,
          })),
        })),
      },
    },
    null,
    2,
  );
}
