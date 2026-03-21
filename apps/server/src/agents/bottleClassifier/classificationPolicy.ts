import {
  getExistingMatchIdentityConflicts,
  hasSupportiveWebEvidenceForExistingMatch,
} from "@peated/server/lib/bottleClassificationEvidence";
import { normalizeBottleCreationDrafts } from "@peated/server/lib/bottleCreationDrafts";
import { normalizeString } from "@peated/server/lib/normalize";
import type {
  BottleClassificationArtifacts,
  BottleReference,
} from "./contract";
import { BottleClassificationError } from "./runBottleClassifierAgent";
import type {
  BottleCandidate,
  BottleMatchDecision,
  EntityResolution,
} from "./schemas";

const NON_WHISKY_KEYWORDS =
  /\b(vodka|gin|rum|tequila|mezcal|sotol|soju|baijiu|sake|shochu|brandy|cognac|armagnac|liqueur)\b/i;
const WHISKY_KEYWORDS =
  /\b(whisk(?:e)?y|single malt|single grain|single pot still|bourbon|rye|scotch|malt whisky|malt whiskey)\b/i;
const GENERIC_NAME_TOKENS = new Set([
  "american",
  "and",
  "bottle",
  "bourbon",
  "canadian",
  "cl",
  "irish",
  "japanese",
  "kentucky",
  "l",
  "malt",
  "ml",
  "of",
  "old",
  "oz",
  "rye",
  "scotch",
  "single",
  "spirit",
  "spirits",
  "straight",
  "the",
  "whiskey",
  "whisky",
  "world",
  "year",
  "years",
  "yr",
  "yrs",
]);

function normalizeClassifierConfidence(confidence: number): number {
  const percentageConfidence = confidence <= 1 ? confidence * 100 : confidence;
  return Math.min(100, Math.max(0, Math.round(percentageConfidence)));
}

function normalizeEntityChoiceName(name: string): string {
  return normalizeString(name).toLowerCase();
}

function normalizeComparableText(value: string | null | undefined): string {
  return normalizeString(value ?? "")
    .toLowerCase()
    .replace(/_/g, " ")
    .trim();
}

function getComparableDomain(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  } catch {
    return null;
  }
}

function domainMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function getComparableNameTokens(value: string | null | undefined): string[] {
  return normalizeComparableText(value)
    .replace(/\b\d+(?:\.\d+)?\s?(?:ml|cl|l|oz)\b/g, " ")
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length > 0 && !GENERIC_NAME_TOKENS.has(token));
}

function tokenSetsMatchExactly(left: string[], right: string[]): boolean {
  if (!left.length || !right.length) {
    return false;
  }

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (leftSet.size !== rightSet.size) {
    return false;
  }

  for (const token of leftSet) {
    if (!rightSet.has(token)) {
      return false;
    }
  }

  return true;
}

function isBasicallyExactNameMatch(
  referenceName: string,
  candidateName: string | null | undefined,
): boolean {
  return tokenSetsMatchExactly(
    getComparableNameTokens(referenceName),
    getComparableNameTokens(candidateName),
  );
}

function getSearchEvidenceText(
  evidence: BottleClassificationArtifacts["searchEvidence"][number],
  result: BottleClassificationArtifacts["searchEvidence"][number]["results"][number],
): string {
  return [
    evidence.summary,
    result.title,
    result.description,
    ...result.extraSnippets,
  ]
    .filter(Boolean)
    .join(" ");
}

function getSuggestedTarget(
  decision: BottleMatchDecision,
  candidates: BottleCandidate[],
): BottleCandidate | null {
  if (
    (decision.action !== "match_existing" &&
      decision.action !== "correction") ||
    decision.suggestedBottleId === null
  ) {
    return null;
  }

  return (
    candidates.find(
      (candidate) =>
        candidate.bottleId === decision.suggestedBottleId &&
        (decision.suggestedReleaseId != null
          ? candidate.releaseId === decision.suggestedReleaseId
          : candidate.releaseId === null || candidate.kind === "bottle"),
    ) ?? null
  );
}

function getTargetNameCandidates(
  target: BottleCandidate,
  decision: BottleMatchDecision,
): string[] {
  const names =
    decision.suggestedReleaseId != null || target.kind === "release"
      ? [target.alias, target.fullName]
      : [
          target.alias,
          target.bottleFullName ?? target.fullName,
          target.fullName,
        ];

  return Array.from(new Set(names.filter(Boolean))) as string[];
}

function hasSupportiveWebEvidenceForTarget({
  target,
  decision,
  reference,
  artifacts,
}: {
  target: BottleCandidate;
  decision: BottleMatchDecision;
  reference: BottleReference;
  artifacts: BottleClassificationArtifacts;
}): boolean {
  if (
    reference.url &&
    hasSupportiveWebEvidenceForExistingMatch({
      sourceUrl: reference.url,
      target,
      extractedLabel: artifacts.extractedIdentity,
      searchEvidence: artifacts.searchEvidence,
    })
  ) {
    return true;
  }

  const referenceDomain = getComparableDomain(reference.url ?? null);
  const targetTokenSets = getTargetNameCandidates(target, decision)
    .map((name) => getComparableNameTokens(name))
    .filter((tokens) => tokens.length > 0);

  if (!targetTokenSets.length) {
    return false;
  }

  for (const evidence of artifacts.searchEvidence) {
    for (const result of evidence.results) {
      const resultDomain = getComparableDomain(result.url);
      if (
        !resultDomain ||
        (referenceDomain !== null &&
          domainMatches(resultDomain, referenceDomain))
      ) {
        continue;
      }

      const resultTokens = new Set(
        getComparableNameTokens(getSearchEvidenceText(evidence, result)),
      );
      if (!resultTokens.size) {
        continue;
      }

      if (
        targetTokenSets.some((tokens) =>
          tokens.every((token) => resultTokens.has(token)),
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

function downgradeUnsafeExistingMatchDecision({
  reference,
  decision,
  artifacts,
}: {
  reference: BottleReference;
  decision: BottleMatchDecision;
  artifacts: BottleClassificationArtifacts;
}): BottleMatchDecision {
  const target = getSuggestedTarget(decision, artifacts.candidates);
  if (!target || target.source.includes("exact")) {
    return decision;
  }

  const hasExactishLocalName = getTargetNameCandidates(target, decision).some(
    (name) => isBasicallyExactNameMatch(reference.name, name),
  );
  const hasSupportiveWebEvidence = hasSupportiveWebEvidenceForTarget({
    target,
    decision,
    reference,
    artifacts,
  });
  const identityConflicts = getExistingMatchIdentityConflicts({
    target,
    extractedLabel: artifacts.extractedIdentity,
  });

  if (
    !identityConflicts.length &&
    (hasExactishLocalName || hasSupportiveWebEvidence)
  ) {
    return decision;
  }

  const reasons: string[] = [];
  if (identityConflicts.length) {
    reasons.push(
      `the candidate conflicts with extracted reference details (${identityConflicts.join(
        "; ",
      )})`,
    );
  }
  if (!hasExactishLocalName && !hasSupportiveWebEvidence) {
    reasons.push(
      "there is no exact alias, no basically exact canonical name match, and no supportive off-retailer web evidence for the suggested target",
    );
  }

  const rationalePrefix = decision.rationale ? `${decision.rationale} ` : "";
  return {
    action: "no_match",
    confidence: decision.confidence,
    rationale: `${rationalePrefix}Server downgraded the existing-match recommendation because ${reasons.join(
      " and ",
    )}.`,
    candidateBottleIds: decision.candidateBottleIds,
    suggestedBottleId: null,
    suggestedReleaseId: null,
    parentBottleId: null,
    creationTarget: null,
    proposedBottle: null,
    proposedRelease: null,
  };
}

function sanitizeResolvedEntityChoice(
  choice: {
    id: number | null;
    name: string;
  },
  expectedType: "brand" | "distiller" | "bottler",
  resolvedEntities: Map<number, EntityResolution>,
): {
  id: number | null;
  name: string;
} {
  if (choice.id === null) {
    return choice;
  }

  const resolvedEntity = resolvedEntities.get(choice.id);
  if (!resolvedEntity || !resolvedEntity.type.includes(expectedType)) {
    return {
      ...choice,
      id: null,
    };
  }

  const normalizedChoiceName = normalizeEntityChoiceName(choice.name);
  const matchedNames = [
    resolvedEntity.name,
    resolvedEntity.shortName,
    resolvedEntity.alias,
  ]
    .filter((name): name is string => Boolean(name))
    .map(normalizeEntityChoiceName);

  if (!matchedNames.includes(normalizedChoiceName)) {
    return {
      ...choice,
      id: null,
    };
  }

  return {
    id: resolvedEntity.entityId,
    name: resolvedEntity.name,
  };
}

function sanitizeProposedBottleDraft(
  proposedBottle: NonNullable<BottleMatchDecision["proposedBottle"]>,
  resolvedEntitiesById: Map<number, EntityResolution>,
): NonNullable<BottleMatchDecision["proposedBottle"]> {
  return {
    ...proposedBottle,
    category:
      proposedBottle.category === "spirit" ? null : proposedBottle.category,
    series: proposedBottle.series
      ? {
          ...proposedBottle.series,
          id: null,
        }
      : null,
    brand: sanitizeResolvedEntityChoice(
      proposedBottle.brand,
      "brand",
      resolvedEntitiesById,
    ),
    distillers: proposedBottle.distillers.map((distiller) =>
      sanitizeResolvedEntityChoice(
        distiller,
        "distiller",
        resolvedEntitiesById,
      ),
    ),
    bottler: proposedBottle.bottler
      ? sanitizeResolvedEntityChoice(
          proposedBottle.bottler,
          "bottler",
          resolvedEntitiesById,
        )
      : null,
  };
}

function sanitizeClassifierDecision(
  decision: BottleMatchDecision,
  artifacts: BottleClassificationArtifacts,
): BottleMatchDecision {
  const candidateBottleIds = new Set(
    artifacts.candidates.map((candidate) => candidate.bottleId),
  );
  const candidateReleaseIds = new Set(
    artifacts.candidates
      .map((candidate) => candidate.releaseId)
      .filter((releaseId): releaseId is number => releaseId !== null),
  );
  const resolvedEntitiesById = new Map(
    artifacts.resolvedEntities.map((entity) => [entity.entityId, entity]),
  );

  if (
    decision.suggestedBottleId !== null &&
    !candidateBottleIds.has(decision.suggestedBottleId)
  ) {
    throw new BottleClassificationError(
      `Classifier returned unknown suggested bottle id (${decision.suggestedBottleId}).`,
      artifacts,
    );
  }

  if (
    decision.suggestedReleaseId != null &&
    !candidateReleaseIds.has(decision.suggestedReleaseId)
  ) {
    throw new BottleClassificationError(
      `Classifier returned unknown suggested release id (${decision.suggestedReleaseId}).`,
      artifacts,
    );
  }

  if (
    decision.action === "create_new" &&
    decision.parentBottleId !== null &&
    decision.parentBottleId !== undefined &&
    !candidateBottleIds.has(decision.parentBottleId)
  ) {
    throw new BottleClassificationError(
      `Classifier returned unknown parent bottle id (${decision.parentBottleId}).`,
      artifacts,
    );
  }

  const normalizedConfidence = normalizeClassifierConfidence(
    decision.confidence,
  );
  const filteredCandidateBottleIds = decision.candidateBottleIds.filter((id) =>
    candidateBottleIds.has(id),
  );

  if (decision.action === "create_new") {
    const sanitizedBottleDraft = decision.proposedBottle
      ? sanitizeProposedBottleDraft(
          decision.proposedBottle,
          resolvedEntitiesById,
        )
      : null;
    const normalizedDrafts = normalizeBottleCreationDrafts({
      creationTarget: decision.creationTarget ?? null,
      proposedBottle: sanitizedBottleDraft,
      proposedRelease: decision.proposedRelease ?? null,
    });

    return {
      ...decision,
      confidence: normalizedConfidence,
      suggestedBottleId: null,
      suggestedReleaseId: null,
      creationTarget: normalizedDrafts.creationTarget,
      candidateBottleIds: filteredCandidateBottleIds,
      proposedBottle: normalizedDrafts.proposedBottle,
      proposedRelease: normalizedDrafts.proposedRelease,
    };
  }

  if (
    decision.action === "match_existing" ||
    decision.action === "correction"
  ) {
    return {
      ...decision,
      confidence: normalizedConfidence,
      candidateBottleIds: filteredCandidateBottleIds,
      proposedBottle: null,
      proposedRelease: null,
      parentBottleId: null,
      creationTarget: null,
    };
  }

  return {
    ...decision,
    confidence: normalizedConfidence,
    suggestedBottleId: null,
    suggestedReleaseId: null,
    parentBottleId: null,
    creationTarget: null,
    candidateBottleIds: filteredCandidateBottleIds,
    proposedBottle: null,
    proposedRelease: null,
  };
}

export function shouldAutoIgnoreBottleReference(
  referenceName: string,
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"],
): boolean {
  if (extractedIdentity) {
    return false;
  }

  // Keep this fast path limited to trivial category exclusions. Flavored
  // whisky / novelty-drink detection is intentionally handled by the LLM
  // prompts because bottle reference titles are too inconsistent
  // and brittle for regex heuristics to stay reliable.
  const normalizedName = normalizeString(referenceName).toLowerCase();
  return (
    NON_WHISKY_KEYWORDS.test(normalizedName) &&
    !WHISKY_KEYWORDS.test(normalizedName)
  );
}

export function finalizeBottleReferenceClassification({
  reference,
  decision,
  artifacts,
}: {
  reference: BottleReference;
  decision: BottleMatchDecision;
  artifacts: BottleClassificationArtifacts;
}): BottleMatchDecision {
  const sanitizedDecision = sanitizeClassifierDecision(decision, artifacts);
  return downgradeUnsafeExistingMatchDecision({
    reference,
    decision: sanitizedDecision,
    artifacts,
  });
}
