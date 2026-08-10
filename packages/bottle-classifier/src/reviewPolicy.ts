import { normalizePotentialProofLikeDecision } from "./abv";
import {
  exactEditionMarkersMatch,
  extractedIdentityLooksLikePlainAgeStatementReference,
  getExistingMatchIdentityConflicts,
} from "./bottleClassificationEvidence";
import { normalizeProposedBottleDraft } from "./bottleCreationDrafts";
import {
  BottleClassificationDecisionSchema,
  BottleClassifierAgentDecisionSchema,
  type BottleCandidate,
  type BottleClassificationDecision,
  type BottleClassifierAgentDecision,
  type BottleClassifierAgentDecisionInput,
  type BottleObservation,
  type EntityResolution,
  type ProposedBottle,
} from "./classifierTypes";
import type {
  BottleClassificationArtifacts,
  BottleReference,
} from "./contract";
import { BottleClassificationError } from "./error";
import {
  candidateHasExactCaskCodeAnchor,
  getExactCaskCodeAnchor,
} from "./exactCask";
import {
  hasExactCaskSignals,
  inferBottleIdentityScope,
} from "./exactCaskPolicy";
import { listMatchesExpectedValue } from "./identityEvidenceCore";
import { normalizeString } from "./normalize";
import { normalizeObservation } from "./observation";
import {
  candidateLooksSmws,
  getSmwsCodeAnchor,
  maybeResolveSmwsExactCaskCodeDecision,
  normalizeSmwsExactCaskProposedBottleDraft,
} from "./smwsPolicy";

// These deterministic patterns are only reject/scope guards. They must not grow
// into whisky taxonomy inference or semantic action promotion: new phrase rules
// require verified whisky research and focused tests, and ambiguous styles belong
// to the web-enabled classifier.
const NON_WHISKY_KEYWORDS =
  /\b(vodka|gin|rum|tequila|mezcal|sotol|soju|baijiu|sake|shochu|brandy|cognac|armagnac|liqueur)\b/i;
const GIFT_SET_PACKAGING_KEYWORDS =
  /\b(gift set|gift pack|gift box|holiday pack|with glass|with glasses|glassware)\b/i;
const MULTI_ITEM_REFERENCE_PATTERNS = [
  GIFT_SET_PACKAGING_KEYWORDS,
  /\bbundle\b/i,
  /\b(?:sampler|tasting|variety)\s+(?:pack|set|bundle)\b/i,
  /\b\d+\s*(?:-|x)?\s*pack\b/i,
  /\b(?:pack|set|case)\s+of\s+\d+\b/i,
  /\b\d+\s*x\s*\d+(?:\.\d+)?\s?(?:ml|cl|l|oz)\b/i,
] as const;
const NON_STANDARD_CONDITION_REFERENCE_PATTERNS = [
  /\bblooper bottle\b/i,
  /\bbroken (?:wax )?seal\b/i,
  /\b(?:opened|open)\s+bottle\b/i,
  /\blow fill\b/i,
  /\bleak(?:ing)?\b/i,
  /\b(?:damaged|missing|cracked|torn|scuffed)\s+(?:box|tube|tin|wax|seal|stopper|label)\b/i,
] as const;
const WHISKY_KEYWORDS =
  /\b(whisk(?:e)?y|single malt|single grain|single pot still|bourbon|rye|scotch|malt whisky|malt whiskey)\b/i;
const GENERIC_NAME_TOKENS = new Set([
  "aged",
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
const GIFT_SET_PACKAGING_TOKENS = new Set([
  "box",
  "gift",
  "glass",
  "glasses",
  "glassware",
  "holiday",
  "pack",
  "set",
  "unknown",
  "with",
]);
function appendRationale(
  rationale: string | null,
  addition: string,
): string | null {
  return rationale ? `${rationale} ${addition}` : addition;
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsComparablePhrase(haystack: string, needle: string): boolean {
  if (!haystack || !needle) {
    return false;
  }

  const pattern = new RegExp(
    `(^|[^a-z0-9])${escapeRegExp(needle)}($|[^a-z0-9])`,
  );

  return pattern.test(haystack);
}

function textsOverlap(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const normalizedLeft = normalizeComparableText(left);
  const normalizedRight = normalizeComparableText(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return (
    normalizedLeft === normalizedRight ||
    containsComparablePhrase(normalizedLeft, normalizedRight) ||
    containsComparablePhrase(normalizedRight, normalizedLeft)
  );
}

function getComparableNameTokens(value: string | null | undefined): string[] {
  return normalizeNameTokenizationText(value)
    .replace(/\b\d+(?:\.\d+)?\s?(?:ml|cl|l|oz)\b/g, " ")
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length > 0 && !GENERIC_NAME_TOKENS.has(token));
}

function normalizeNameTokenizationText(
  value: string | null | undefined,
): string {
  return normalizeComparableText(value)
    .replace(/\b([a-z0-9]+)'s\b/g, "$1s")
    .replace(/\b([a-z0-9]+)s'\b/g, "$1s");
}

function getMatchedTarget(
  decision: BottleClassificationDecision,
  candidates: BottleCandidate[],
): BottleCandidate | null {
  if (decision.action !== "match") {
    return null;
  }

  return (
    candidates.find(
      (candidate) => candidate.bottleId === decision.matchedBottleId,
    ) ?? null
  );
}

function maybeRejectExactCaskCreateDuplicate({
  decision,
  artifacts,
}: {
  decision: BottleClassificationDecision;
  artifacts: BottleClassificationArtifacts;
}): BottleClassificationDecision | null {
  if (
    decision.action !== "create_bottle" ||
    decision.identityScope !== "exact_cask" ||
    !decision.proposedBottle
  ) {
    return null;
  }

  const exactCaskAnchor =
    getExactCaskCodeAnchor(decision.observation?.caskNumber) ??
    getExactCaskCodeAnchor(decision.proposedBottle?.name) ??
    getExactCaskCodeAnchor(artifacts.extractedIdentity?.edition) ??
    getExactCaskCodeAnchor(artifacts.extractedIdentity?.expression);

  if (!exactCaskAnchor) {
    return null;
  }

  const proposedBottle = decision.proposedBottle;
  const existingTarget =
    artifacts.candidates
      .filter(
        (candidate) =>
          candidateHasExactCaskCodeAnchor(candidate, exactCaskAnchor) &&
          candidateStructurallyMatchesExactCaskDraft({
            target: candidate,
            proposedBottle,
          }) &&
          !proposedBottleHasKnownTargetConflict({
            target: candidate,
            proposedBottle,
            extractedIdentity: artifacts.extractedIdentity,
          }),
      )
      .sort((left, right) => {
        if (left.source.includes("exact") !== right.source.includes("exact")) {
          return left.source.includes("exact") ? -1 : 1;
        }

        return (right.score ?? 0) - (left.score ?? 0);
      })[0] ?? null;

  if (!existingTarget) {
    return null;
  }

  return createNoMatchDecision({
    decision,
    candidateBottleIds: Array.from(
      new Set([...decision.candidateBottleIds, existingTarget.bottleId]),
    ),
    observation: decision.observation,
    identityScope: "exact_cask",
    rationale: appendRationale(
      decision.rationale,
      "Server downgraded exact-cask creation because an existing local Bottle already has the exact code anchor; the reviewed action must select that Bottle explicitly.",
    ),
  });
}

function getBottleTargetNameCandidates(target: BottleCandidate): string[] {
  return Array.from(
    new Set(
      [target.alias, target.fullName]
        .filter(Boolean)
        .map((value) => value!.trim())
        .filter((value) => value.length > 0),
    ),
  );
}

function getProposedBottleNameCandidates(proposedBottle: ProposedBottle) {
  return Array.from(
    new Set(
      [
        proposedBottle.name,
        `${proposedBottle.brand.name} ${proposedBottle.name}`,
        proposedBottle.series
          ? `${proposedBottle.brand.name} ${proposedBottle.series.name} ${proposedBottle.name}`
          : null,
      ]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );
}

function candidateStructurallyMatchesExactCaskDraft({
  target,
  proposedBottle,
}: {
  target: BottleCandidate;
  proposedBottle: ProposedBottle;
}): boolean {
  if (
    normalizeComparableText(target.brand) !==
    normalizeComparableText(proposedBottle.brand.name)
  ) {
    return false;
  }

  const targetNames = getBottleTargetNameCandidates(target).map((name) =>
    normalizeComparableText(name),
  );
  const proposedNames = getProposedBottleNameCandidates(proposedBottle).map(
    (name) => normalizeComparableText(name),
  );
  if (!proposedNames.some((name) => targetNames.includes(name))) {
    return false;
  }

  return (
    normalizeComparableText(target.series) ===
    normalizeComparableText(proposedBottle.series?.name)
  );
}

function stringListsOverlap(
  actualValues: string[],
  expectedValues: string[],
): boolean {
  if (!actualValues.length || !expectedValues.length) {
    return false;
  }

  return expectedValues.every((expectedValue) =>
    actualValues.some((actualValue) =>
      textsOverlap(actualValue, expectedValue),
    ),
  );
}

function proposedBottleChangesOnlyLegacyGenericCategory({
  target,
  proposedBottle,
  extractedIdentity,
}: {
  target: BottleCandidate;
  proposedBottle: ProposedBottle;
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"];
}) {
  return (
    target.category === "spirit" &&
    proposedBottle.category !== null &&
    proposedBottle.category === extractedIdentity?.category
  );
}

function proposedBottleNeedsMaterialTargetRepair({
  target,
  proposedBottle,
  extractedIdentity,
}: {
  target: BottleCandidate;
  proposedBottle: ProposedBottle;
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"];
}): boolean {
  if (
    target.brand &&
    !textsOverlap(target.brand, proposedBottle.brand.name) &&
    !getBottleTargetNameCandidates(target).some((name) =>
      textsOverlap(name, proposedBottle.brand.name),
    )
  ) {
    return true;
  }

  if (
    proposedBottle.category !== null &&
    target.category !== proposedBottle.category &&
    !proposedBottleChangesOnlyLegacyGenericCategory({
      target,
      proposedBottle,
      extractedIdentity,
    })
  ) {
    return true;
  }

  if (
    proposedBottle.series &&
    !textsOverlap(target.series, proposedBottle.series.name)
  ) {
    return true;
  }

  if (
    proposedBottle.bottler &&
    !textsOverlap(target.bottler, proposedBottle.bottler.name)
  ) {
    return true;
  }

  if (
    proposedBottle.distillers.length > 0 &&
    target.distillery.length > 0 &&
    !stringListsOverlap(
      target.distillery,
      proposedBottle.distillers.map((distiller) => distiller.name),
    )
  ) {
    return true;
  }

  if (
    proposedBottle.statedAge !== null &&
    target.statedAge !== proposedBottle.statedAge
  ) {
    return true;
  }

  if (
    proposedBottle.edition &&
    !exactEditionMarkersMatch(target.edition, proposedBottle.edition)
  ) {
    return true;
  }

  if (
    proposedBottle.caskStrength !== null &&
    target.caskStrength !== proposedBottle.caskStrength
  ) {
    return true;
  }

  if (
    proposedBottle.singleCask !== null &&
    target.singleCask !== proposedBottle.singleCask
  ) {
    return true;
  }

  if (proposedBottle.abv !== null && target.abv !== proposedBottle.abv) {
    return true;
  }

  if (
    proposedBottle.vintageYear !== null &&
    target.vintageYear !== proposedBottle.vintageYear
  ) {
    return true;
  }

  if (
    proposedBottle.releaseYear !== null &&
    target.releaseYear !== proposedBottle.releaseYear
  ) {
    return true;
  }

  return false;
}

function proposedBottleHasKnownTargetConflict({
  target,
  proposedBottle,
  extractedIdentity,
}: {
  target: BottleCandidate;
  proposedBottle: ProposedBottle;
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"];
}): boolean {
  return proposedBottleNeedsMaterialTargetRepair({
    target,
    proposedBottle: {
      ...proposedBottle,
      abv: target.abv === null ? null : proposedBottle.abv,
      caskStrength:
        target.caskStrength === null ? null : proposedBottle.caskStrength,
      singleCask: target.singleCask === null ? null : proposedBottle.singleCask,
    },
    extractedIdentity,
  });
}

function createNoMatchDecision({
  decision,
  candidateBottleIds,
  rationale,
  observation,
  identityScope,
}: {
  decision: Pick<BottleClassifierAgentDecision, "rationale" | "identityScope"> &
    Partial<Pick<BottleClassifierAgentDecision, "aliasScope">> &
    Partial<Pick<BottleClassifierAgentDecision, "confidenceBasis">>;
  candidateBottleIds: number[];
  rationale: string | null;
  observation: BottleObservation | null;
  identityScope?: BottleClassificationDecision["identityScope"];
}): BottleClassificationDecision {
  return BottleClassificationDecisionSchema.parse({
    action: "no_match",
    rationale,
    candidateBottleIds,
    identityScope: identityScope ?? decision.identityScope ?? "product",
    aliasScope: decision.aliasScope ?? "none",
    observation,
    confidenceBasis: decision.confidenceBasis ?? null,
    matchedBottleId: null,
    proposedBottle: null,
  });
}

function rejectInvalidExistingMatch({
  reference,
  decision,
  artifacts,
}: {
  reference: BottleReference;
  decision: BottleClassificationDecision;
  artifacts: BottleClassificationArtifacts;
}): BottleClassificationDecision {
  if (decision.action !== "match") {
    return decision;
  }

  const target = getMatchedTarget(decision, artifacts.candidates);
  if (!target) {
    return createNoMatchDecision({
      decision,
      candidateBottleIds: decision.candidateBottleIds,
      observation: decision.observation,
      identityScope: decision.identityScope,
      rationale: appendRationale(
        decision.rationale,
        "Server downgraded the existing-match recommendation because the matched target was not present in the reviewed candidates.",
      ),
    });
  }

  const identityConflicts = getExistingMatchIdentityConflicts({
    referenceName: reference.name,
    targetCandidate: target,
    extractedLabel: artifacts.extractedIdentity,
  });

  const smwsCode = getSmwsCodeAnchor({ reference, decision, artifacts });
  const materialIdentityConflicts =
    smwsCode &&
    candidateLooksSmws(target) &&
    candidateHasExactCaskCodeAnchor(target, smwsCode)
      ? identityConflicts.filter((field) => field !== "brand")
      : identityConflicts;

  if (!materialIdentityConflicts.length) {
    return decision;
  }

  const downgradedRationale = appendRationale(
    decision.rationale,
    `Server downgraded the existing-match recommendation because the candidate conflicts with extracted reference details (${materialIdentityConflicts.join(
      "; ",
    )}).`,
  );
  return createNoMatchDecision({
    decision,
    candidateBottleIds: decision.candidateBottleIds,
    observation: decision.observation,
    identityScope: decision.identityScope,
    rationale: downgradedRationale,
  });
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
  proposedBottle: NonNullable<BottleClassificationDecision["proposedBottle"]>,
  resolvedEntitiesById: Map<number, EntityResolution>,
): NonNullable<BottleClassificationDecision["proposedBottle"]> {
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

function sanitizeClassifierDecision({
  reference,
  decision,
  artifacts,
}: {
  reference: BottleReference;
  decision: BottleClassifierAgentDecision;
  artifacts: BottleClassificationArtifacts;
}): BottleClassificationDecision {
  const candidateBottleIds = new Set(
    artifacts.candidates.map((candidate) => candidate.bottleId),
  );
  const resolvedEntitiesById = new Map(
    artifacts.resolvedEntities.map((entity) => [entity.entityId, entity]),
  );
  const filteredCandidateBottleIds = decision.candidateBottleIds.filter((id) =>
    candidateBottleIds.has(id),
  );
  const observation = normalizeObservation(decision.observation);

  if (decision.action === "match") {
    if (decision.matchedBottleId === null) {
      return createNoMatchDecision({
        decision: {
          rationale: decision.rationale,
          identityScope: decision.identityScope,
        },
        candidateBottleIds: filteredCandidateBottleIds,
        observation,
        identityScope: "product",
        rationale: appendRationale(
          decision.rationale,
          "Server downgraded match because no matched bottle id was returned.",
        ),
      });
    }

    const matchedBottleId = decision.matchedBottleId;
    if (!candidateBottleIds.has(matchedBottleId)) {
      throw new BottleClassificationError(
        `Classifier returned unknown matched bottle id (${matchedBottleId}).`,
        artifacts,
      );
    }

    const target =
      artifacts.candidates.find(
        (candidate) => candidate.bottleId === matchedBottleId,
      ) ?? null;

    return {
      action: "match",
      rationale: decision.rationale,
      candidateBottleIds: filteredCandidateBottleIds,
      identityScope: inferBottleIdentityScope({
        requestedIdentityScope: decision.identityScope,
        reference,
        target,
        extractedIdentity: artifacts.extractedIdentity,
        proposedBottle: null,
        observation,
      }),
      observation,
      matchedBottleId,
      proposedBottle: null,
    };
  }

  if (decision.action === "create_bottle") {
    if (!decision.proposedBottle) {
      return createNoMatchDecision({
        decision: {
          ...decision,
        },
        candidateBottleIds: filteredCandidateBottleIds,
        observation,
        identityScope: "product",
        rationale: appendRationale(
          decision.rationale,
          "Server downgraded create_bottle because no proposed bottle draft was returned.",
        ),
      });
    }

    const sanitizedBottleDraft = normalizeSmwsExactCaskProposedBottleDraft({
      extractedIdentity: artifacts.extractedIdentity,
      proposedBottle: sanitizeProposedBottleDraft(
        decision.proposedBottle,
        resolvedEntitiesById,
      ),
      reference,
    });
    const proposedBottleDraft =
      normalizeProposedBottleDraft(sanitizedBottleDraft);
    const smwsAnchorDecision: BottleClassificationDecision = {
      ...decision,
      action: "create_bottle",
      identityScope: decision.identityScope ?? "product",
      aliasScope: decision.aliasScope ?? undefined,
      matchedBottleId: null,
      proposedBottle: proposedBottleDraft,
    };
    const hasSmwsCodeAnchor = Boolean(
      getSmwsCodeAnchor({
        reference,
        decision: smwsAnchorDecision,
        artifacts,
      }),
    );

    return {
      action: "create_bottle",
      rationale: decision.rationale,
      candidateBottleIds: filteredCandidateBottleIds,
      identityScope: inferBottleIdentityScope({
        requestedIdentityScope:
          decision.identityScope === "exact_cask" ||
          hasExactCaskSignals({
            reference,
            proposedBottle: proposedBottleDraft,
            extractedIdentity: artifacts.extractedIdentity,
            observation,
          })
            ? "exact_cask"
            : decision.identityScope,
        reference,
        target: null,
        extractedIdentity: artifacts.extractedIdentity,
        proposedBottle: proposedBottleDraft,
        observation,
      }),
      observation,
      matchedBottleId: null,
      proposedBottle: proposedBottleDraft,
    };
  }

  return createNoMatchDecision({
    decision: {
      rationale: decision.rationale,
      identityScope: inferBottleIdentityScope({
        requestedIdentityScope: decision.identityScope,
        reference,
        target: null,
        extractedIdentity: artifacts.extractedIdentity,
        proposedBottle: null,
        observation,
      }),
      confidenceBasis: decision.confidenceBasis,
    },
    candidateBottleIds: filteredCandidateBottleIds,
    observation,
    rationale: decision.rationale,
  });
}

export function shouldAutoIgnoreBottleReference(
  referenceName: string,
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"],
): boolean {
  return (
    getAutoIgnoreBottleReferenceReason(referenceName, extractedIdentity) !==
    null
  );
}

export function getAutoIgnoreBottleReferenceReason(
  referenceName: string,
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"],
): string | null {
  const normalizedName = normalizeString(referenceName).toLowerCase();
  if (!extractedIdentity) {
    if (
      NON_WHISKY_KEYWORDS.test(normalizedName) &&
      !WHISKY_KEYWORDS.test(normalizedName)
    ) {
      return "Reference is clearly a non-whisky category match and extraction found no whisky identity.";
    }

    if (GIFT_SET_PACKAGING_KEYWORDS.test(normalizedName)) {
      const identityTokens = getComparableNameTokens(normalizedName).filter(
        (token) =>
          !GIFT_SET_PACKAGING_TOKENS.has(token) && !/^\d+$/.test(token),
      );
      if (identityTokens.length === 0) {
        return "Reference is packaging-only gift-set text and extraction found no whisky identity.";
      }
    }
  }

  if (
    MULTI_ITEM_REFERENCE_PATTERNS.some((pattern) =>
      pattern.test(normalizedName),
    )
  ) {
    return "Reference is a bundle or multi-bottle listing, not a single bottle listing.";
  }

  if (
    NON_STANDARD_CONDITION_REFERENCE_PATTERNS.some((pattern) =>
      pattern.test(normalizedName),
    )
  ) {
    return "Reference describes a damaged or non-standard sale-condition bottle, not a standard bottle listing.";
  }

  return null;
}

export function finalizeBottleReferenceClassification({
  reference,
  decision,
  artifacts,
}: {
  reference: BottleReference;
  decision: BottleClassifierAgentDecisionInput;
  artifacts: BottleClassificationArtifacts;
}): BottleClassificationDecision {
  const parsedDecision: BottleClassifierAgentDecision =
    BottleClassifierAgentDecisionSchema.parse(
      normalizePotentialProofLikeDecision(decision),
    );
  const sanitizedDecision = sanitizeClassifierDecision({
    reference,
    decision: parsedDecision,
    artifacts,
  });
  const smwsCodeAdjustedDecision =
    maybeResolveSmwsExactCaskCodeDecision({
      reference,
      decision: sanitizedDecision,
      artifacts,
    }) ?? sanitizedDecision;
  const exactCaskAdjustedDecision =
    maybeRejectExactCaskCreateDuplicate({
      decision: smwsCodeAdjustedDecision,
      artifacts,
    }) ?? smwsCodeAdjustedDecision;
  const agentEvidenceAdjustedDecision = {
    ...exactCaskAdjustedDecision,
    confidenceBasis:
      exactCaskAdjustedDecision.confidenceBasis ??
      parsedDecision.confidenceBasis,
  };
  // The former numeric/band reconciliation caps (capUnverifiedCreationAutomation,
  // capAutoVerificationWithUnresolvedRisks, capIneligibleExistingMatchAutoVerification)
  // were retired with numeric confidence and the confidence band. Automated
  // consumers now derive review routing from structured evidence via
  // `deriveAutomationTier`, so review gating no longer lives in this pipeline.
  const reviewedDecision = rejectInvalidExistingMatch({
    reference,
    decision: agentEvidenceAdjustedDecision,
    artifacts,
  });

  return BottleClassificationDecisionSchema.parse({
    ...reviewedDecision,
    aliasScope:
      reviewedDecision.aliasScope ?? parsedDecision.aliasScope ?? "none",
    confidenceBasis:
      reviewedDecision.confidenceBasis ?? parsedDecision.confidenceBasis,
  });
}
