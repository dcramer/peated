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

type BottleLike = NonNullable<QueueItem["parentBottle"]>;

type ProposedBottleLike = NonNullable<QueueItem["proposedBottle"]>;
type ProposedReleaseLike = NonNullable<QueueItem["proposedRelease"]>;
type CatalogTargetLike = NonNullable<
  QueueItem["currentTarget"] | QueueItem["suggestedTarget"]
>;

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

function serializeCatalogTarget(value: CatalogTargetLike | null) {
  if (!value) {
    return null;
  }

  const group = {
    id: value.group.id,
    fullName: value.group.fullName,
    name: value.group.name,
    brandId: value.group.brandId,
    seriesId: value.group.seriesId,
    category: value.group.category,
    statedAge: value.group.statedAge,
    distillerIds: value.group.distillerIds,
    bottlerId: value.group.bottlerId,
  };

  if (value.kind === "group") {
    return {
      kind: value.kind,
      targetId: value.targetId,
      group,
    };
  }

  return {
    kind: value.kind,
    targetId: value.targetId,
    group,
    bottle: {
      id: value.bottle.id,
      groupId: value.bottle.groupId,
      fullName: value.bottle.fullName,
      name: value.bottle.name,
      brandId: value.bottle.brandId,
      seriesId: value.bottle.seriesId,
      category: value.bottle.category,
      distillerIds: value.bottle.distillerIds,
      bottlerId: value.bottle.bottlerId,
      edition: value.bottle.edition,
      statedAge: value.bottle.statedAge,
      abv: value.bottle.abv,
      caskStrength: value.bottle.caskStrength,
      singleCask: value.bottle.singleCask,
      vintageYear: value.bottle.vintageYear,
      releaseYear: value.bottle.releaseYear,
      caskType: value.bottle.caskType,
      caskSize: value.bottle.caskSize,
      caskFill: value.bottle.caskFill,
    },
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
      schemaVersion: 2,
      source: "peated.admin.match_queue",
      proposal: {
        id: item.id,
        status: item.status,
        proposalType: item.proposalType,
        creationTarget: item.creationTarget,
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
          plainAgeBottleAutoVerifyEligible:
            item.plainAgeBottleAutoVerifyEligible,
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
      currentAssignment: serializeCatalogTarget(item.currentTarget),
      recommendation: {
        suggestedTarget: serializeCatalogTarget(item.suggestedTarget),
        createDraft: {
          parentBottle: serializeBottleIdentity(item.parentBottle),
          proposedBottle: serializeProposedBottleDraft(item.proposedBottle),
          proposedBottling: serializeProposedReleaseDraft(item.proposedRelease),
        },
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
