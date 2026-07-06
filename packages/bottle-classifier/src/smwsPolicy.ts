import {
  BottleClassificationDecisionSchema,
  type BottleCandidate,
  type BottleClassificationDecision,
} from "./classifierTypes";
import type {
  BottleClassificationArtifacts,
  BottleReference,
} from "./contract";
import {
  candidateHasExactCaskCodeAnchor,
  getExactCaskCodeAnchor,
} from "./exactCask";
import {
  escapeRegExp,
  normalizeComparableText,
  textsOverlap,
} from "./identityEvidenceCore";
import { normalizeString } from "./normalize";
import { normalizeObservation } from "./observation";
import {
  composeExactCaskCodeFromComponents,
  parseDetailsFromName as parseSmwsDetailsFromName,
} from "./smws";

const BARE_SMWS_CODE_REFERENCE_PATTERN = /^SMWS\s+([A-Z]*\d+\.\d+)$/i;
const SMWS_REFERENCE_PATTERN = /\b(?:SMWS|Scotch Malt Whisky Society)\b/i;
const SMWS_TITLE_NOISE = new Set([
  "single malt",
  "single malt scotch whisky",
  "scotch whisky",
  "whisky",
  "cask strength",
]);

function appendRationale(
  rationale: string | null,
  addition: string,
): string | null {
  return rationale ? `${rationale} ${addition}` : addition;
}

export function isSmwsIdentityAnchor(
  value: string | null | undefined,
): boolean {
  const normalizedValue = normalizeComparableText(value);
  return (
    normalizedValue === "smws" ||
    normalizedValue === "the scotch malt whisky society" ||
    normalizedValue === "scotch malt whisky society"
  );
}

function getBareSmwsCodeReference(
  referenceName: string | null | undefined,
): string | null {
  const match = normalizeString(referenceName ?? "")
    .trim()
    .match(BARE_SMWS_CODE_REFERENCE_PATTERN);

  return match?.[1] ?? null;
}

function textLooksSmws(value: string | null | undefined): boolean {
  return SMWS_REFERENCE_PATTERN.test(value ?? "");
}

export function candidateLooksSmws(candidate: BottleCandidate): boolean {
  return (
    isSmwsIdentityAnchor(candidate.brand) ||
    isSmwsIdentityAnchor(candidate.bottler) ||
    textLooksSmws(candidate.alias) ||
    textLooksSmws(candidate.bottleFullName) ||
    textLooksSmws(candidate.fullName)
  );
}

// Collects every SMWS-relevant text fragment (extracted identity, decision
// draft, reference name, and image OCR spans/observations) into one string so
// deterministic code composition can see both the society anchor and the
// separately labeled distillery/cask components even when they originate from
// different fields.
function getSmwsCompositionText({
  reference,
  decision,
  artifacts,
}: {
  reference: BottleReference;
  decision: BottleClassificationDecision;
  artifacts: BottleClassificationArtifacts;
}): string {
  const fragments: Array<string | null | undefined> = [
    reference.name,
    artifacts.extractedIdentity?.brand,
    artifacts.extractedIdentity?.bottler,
    artifacts.extractedIdentity?.expression,
    artifacts.extractedIdentity?.edition,
    decision.proposedBottle?.brand.name,
    decision.proposedBottle?.bottler?.name,
    decision.proposedBottle?.name,
    decision.proposedBottle?.edition,
  ];

  for (const extractor of artifacts.imageEvidence?.extractors ?? []) {
    for (const span of extractor.textSpans) {
      fragments.push(span.text);
    }
    for (const observation of extractor.observations) {
      fragments.push(observation);
    }
  }

  return fragments
    .filter((fragment): fragment is string => Boolean(fragment))
    .join(" \n ");
}

export function getSmwsCodeAnchor({
  reference,
  decision,
  artifacts,
}: {
  reference: BottleReference;
  decision: BottleClassificationDecision;
  artifacts: BottleClassificationArtifacts;
}): string | null {
  if (
    ![
      reference.name,
      artifacts.extractedIdentity?.brand,
      artifacts.extractedIdentity?.bottler,
      decision.proposedBottle?.brand.name,
      decision.proposedBottle?.bottler?.name,
    ].some((value) => textLooksSmws(value) || isSmwsIdentityAnchor(value))
  ) {
    return null;
  }

  for (const value of [
    decision.observation?.caskNumber,
    reference.name,
    artifacts.extractedIdentity?.edition,
    artifacts.extractedIdentity?.expression,
    decision.proposedBottle?.edition,
    decision.proposedBottle?.name,
  ]) {
    const code = getExactCaskCodeAnchor(value);
    if (code) {
      return code;
    }
  }

  // No printed code found: fall back to composing it from the separately
  // labeled distillery-number and cask-number components on the label.
  return composeExactCaskCodeFromComponents(
    getSmwsCompositionText({ reference, decision, artifacts }),
  );
}

function getSmwsReferenceCodeAnchor({
  reference,
}: {
  reference: BottleReference;
}): string | null {
  if (!textLooksSmws(reference.name)) {
    return null;
  }

  return (
    getExactCaskCodeAnchor(reference.name) ??
    composeExactCaskCodeFromComponents(reference.name)
  );
}

function getSmwsCodeTargetCandidate({
  artifacts,
  code,
}: {
  artifacts: BottleClassificationArtifacts;
  code: string;
}): BottleCandidate | null {
  return (
    artifacts.candidates
      .filter(
        (candidate) =>
          candidateLooksSmws(candidate) &&
          candidateHasExactCaskCodeAnchor(candidate, code),
      )
      .sort((left, right) => {
        if (left.source.includes("exact") !== right.source.includes("exact")) {
          return left.source.includes("exact") ? -1 : 1;
        }

        return (right.score ?? 0) - (left.score ?? 0);
      })[0] ?? null
  );
}

function getSmwsSelectorFromReference({
  referenceName,
  code,
}: {
  referenceName: string;
  code: string;
}): string | null {
  const selector = referenceName
    .replace(SMWS_REFERENCE_PATTERN, "")
    .replace(new RegExp(`\\b${escapeRegExp(code)}\\b`, "i"), "")
    .trim();

  return selector || null;
}

function cleanSmwsTitleCandidate(value: string): string | null {
  const cleaned = value
    .replace(/^[\s.,:;/-]+|[\s.,:;/-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned || SMWS_TITLE_NOISE.has(normalizeComparableText(cleaned))) {
    return null;
  }

  return cleaned;
}

function extractSmwsTitleCandidate({
  value,
  code,
  allowCodeLess,
}: {
  value: string | null | undefined;
  code: string;
  allowCodeLess: boolean;
}): string | null {
  const normalizedValue = normalizeString(value ?? "").trim();
  if (!normalizedValue) {
    return null;
  }

  const containsCode =
    getExactCaskCodeAnchor(normalizedValue) === code ||
    new RegExp(`\\b${escapeRegExp(code)}\\b`, "i").test(normalizedValue);
  if (!containsCode && !allowCodeLess) {
    return null;
  }

  const withoutIdentityMarkers = normalizedValue
    .replace(SMWS_REFERENCE_PATTERN, " ")
    .replace(/\b(?:the\s+)?society\s+cask\s+no\.?\b/gi, " ")
    .replace(/\bcask\s+no\.?\b/gi, " ")
    .replace(new RegExp(`\\b${escapeRegExp(code)}\\b\\.?`, "i"), " ");

  return cleanSmwsTitleCandidate(withoutIdentityMarkers);
}

function getSmwsExactCaskDisplayName({
  code,
  extractedIdentity,
  proposedBottleName,
  reference,
}: {
  code: string;
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"];
  proposedBottleName?: string | null;
  reference: BottleReference;
}): string {
  const title =
    extractSmwsTitleCandidate({
      value: extractedIdentity?.expression,
      code,
      allowCodeLess: true,
    }) ??
    extractSmwsTitleCandidate({
      value: proposedBottleName,
      code,
      allowCodeLess: true,
    }) ??
    extractSmwsTitleCandidate({
      value: reference.name,
      code,
      allowCodeLess: false,
    });

  return title ? `${code} ${title}` : code;
}

function buildSmwsExactCaskBottleDraft({
  artifacts,
  code,
  reference,
}: {
  artifacts: BottleClassificationArtifacts;
  code: string;
  reference: BottleReference;
}): NonNullable<BottleClassificationDecision["proposedBottle"]> {
  const extractedIdentity = artifacts.extractedIdentity;
  const smwsDetails = parseSmwsDetailsFromName(code);
  const extractedDistillers = extractedIdentity?.distillery ?? [];
  const extractedBrand = extractedIdentity?.brand ?? null;
  const extractedBottler = extractedIdentity?.bottler ?? null;
  const brandName =
    extractedBrand && isSmwsIdentityAnchor(extractedBrand)
      ? extractedBrand
      : "SMWS";
  const bottlerName =
    extractedBottler && isSmwsIdentityAnchor(extractedBottler)
      ? extractedBottler
      : "The Scotch Malt Whisky Society";
  const distillerNames =
    extractedDistillers.length > 0
      ? extractedDistillers
      : [smwsDetails?.distiller ?? null];
  const distillers = Array.from(new Set(distillerNames))
    .filter((name): name is string => Boolean(name))
    .map((name) => ({
      id: null,
      name,
    }));

  return {
    name: getSmwsExactCaskDisplayName({
      code,
      extractedIdentity,
      reference,
    }),
    series: null,
    category: extractedIdentity?.category ?? smwsDetails?.category ?? null,
    edition: null,
    statedAge: extractedIdentity?.stated_age ?? null,
    caskStrength: extractedIdentity?.cask_strength ?? null,
    singleCask: true,
    abv: extractedIdentity?.abv ?? null,
    vintageYear: extractedIdentity?.vintage_year ?? null,
    releaseYear: extractedIdentity?.release_year ?? null,
    brand: {
      id: null,
      name: brandName,
    },
    distillers,
    bottler: {
      id: null,
      name: bottlerName,
    },
  };
}

export function normalizeSmwsExactCaskProposedBottleDraft({
  extractedIdentity,
  proposedBottle,
  reference,
}: {
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"];
  proposedBottle: NonNullable<BottleClassificationDecision["proposedBottle"]>;
  reference: BottleReference;
}): NonNullable<BottleClassificationDecision["proposedBottle"]> {
  const brandLooksSmws =
    isSmwsIdentityAnchor(proposedBottle.brand.name) ||
    isSmwsIdentityAnchor(extractedIdentity?.brand) ||
    isSmwsIdentityAnchor(extractedIdentity?.bottler);

  if (!brandLooksSmws) {
    return proposedBottle;
  }

  const smwsCode =
    getBareSmwsCodeReference(reference.name) ??
    getExactCaskCodeAnchor(proposedBottle.edition) ??
    getExactCaskCodeAnchor(proposedBottle.name) ??
    getExactCaskCodeAnchor(extractedIdentity?.edition) ??
    getExactCaskCodeAnchor(extractedIdentity?.expression) ??
    getExactCaskCodeAnchor(reference.name);

  if (smwsCode) {
    return {
      ...proposedBottle,
      name: getSmwsExactCaskDisplayName({
        code: smwsCode,
        extractedIdentity,
        proposedBottleName: proposedBottle.name,
        reference,
      }),
      edition: null,
    };
  }

  const draftCode = proposedBottle.edition ?? extractedIdentity?.edition;
  if (!draftCode || textsOverlap(proposedBottle.name, draftCode)) {
    return proposedBottle;
  }

  return {
    ...proposedBottle,
    name: `${draftCode} ${proposedBottle.name}`.trim(),
    edition: null,
  };
}

export function maybeResolveSmwsExactCaskCodeDecision({
  reference,
  decision,
  artifacts,
}: {
  reference: BottleReference;
  decision: BottleClassificationDecision;
  artifacts: BottleClassificationArtifacts;
}): BottleClassificationDecision | null {
  const smwsCode = getSmwsCodeAnchor({
    reference,
    decision,
    artifacts,
  });
  if (!smwsCode) {
    return null;
  }

  const existingTarget = getSmwsCodeTargetCandidate({
    artifacts,
    code: smwsCode,
  });
  const currentObservation = decision.observation;
  const observation = normalizeObservation({
    barrelNumber: currentObservation?.barrelNumber ?? null,
    bottleNumber: currentObservation?.bottleNumber ?? null,
    outturn: currentObservation?.outturn ?? null,
    market: currentObservation?.market ?? null,
    exclusive: currentObservation?.exclusive ?? null,
    selector:
      currentObservation?.selector ??
      getSmwsSelectorFromReference({
        referenceName: reference.name,
        code: smwsCode,
      }),
    caskNumber: currentObservation?.caskNumber ?? smwsCode,
  });

  if (existingTarget) {
    return {
      action: "match",
      rationale: appendRationale(
        decision.rationale,
        "Server matched the SMWS exact-cask code because SMWS bottle identity is anchored by code, not subtitle.",
      ),
      candidateBottleIds: Array.from(
        new Set([...decision.candidateBottleIds, existingTarget.bottleId]),
      ),
      identityScope: "exact_cask",
      observation,
      matchedBottleId: existingTarget.bottleId,
      matchedReleaseId: null,
      parentBottleId: null,
      proposedBottle: null,
      proposedRelease: null,
    };
  }

  if (decision.action !== "no_match") {
    return null;
  }

  const proposedBottle = buildSmwsExactCaskBottleDraft({
    artifacts,
    code: smwsCode,
    reference,
  });

  return {
    action: "create_bottle",
    rationale: appendRationale(
      decision.rationale,
      "Server created the SMWS exact-cask bottle because the SMWS code is the bottle identity anchor and no local bottle uses it.",
    ),
    candidateBottleIds: decision.candidateBottleIds,
    identityScope: "exact_cask",
    observation,
    matchedBottleId: null,
    matchedReleaseId: null,
    parentBottleId: null,
    proposedBottle,
    proposedRelease: null,
  };
}

export function resolveSmwsExactCaskReference({
  reference,
  artifacts,
}: {
  reference: BottleReference;
  artifacts: BottleClassificationArtifacts;
}): BottleClassificationDecision | null {
  const smwsCode = getSmwsReferenceCodeAnchor({ reference });
  if (!smwsCode) {
    return null;
  }

  const existingTarget = getSmwsCodeTargetCandidate({
    artifacts,
    code: smwsCode,
  });
  const observation = normalizeObservation({
    barrelNumber: null,
    bottleNumber: null,
    outturn: null,
    market: null,
    exclusive: null,
    selector: getSmwsSelectorFromReference({
      referenceName: reference.name,
      code: smwsCode,
    }),
    caskNumber: smwsCode,
  });
  const candidateBottleIds = Array.from(
    new Set([
      ...artifacts.candidates.map((candidate) => candidate.bottleId),
      ...(existingTarget ? [existingTarget.bottleId] : []),
    ]),
  );
  const identityBasis: NonNullable<
    BottleClassificationDecision["identityBasis"]
  > = {
    bottleTraits: [`SMWS exact-cask code ${smwsCode}`],
    releaseTraits: [],
    observationTraits: observation?.selector
      ? [`selector ${observation.selector}`]
      : [],
    yearInterpretation: "none",
    siblingEvidence: "none",
    uncertainties: [],
  };
  const confidenceBasis: NonNullable<
    BottleClassificationDecision["confidenceBasis"]
  > = {
    positiveEvidence: [
      `SMWS exact-cask code ${smwsCode} deterministically identifies the bottle.`,
    ],
    unresolvedRisks: [],
    toolsUsed: ["initial_local_candidates"],
    webEvidence: "not_needed",
  };

  if (existingTarget) {
    return BottleClassificationDecisionSchema.parse({
      action: "match",
      rationale:
        "Server matched the SMWS exact-cask code without agent reasoning because SMWS bottle identity is anchored by code.",
      candidateBottleIds,
      identityScope: "exact_cask",
      observation,
      identityBasis,
      confidenceBasis,
      matchedBottleId: existingTarget.bottleId,
      matchedReleaseId: null,
      parentBottleId: null,
      proposedBottle: null,
      proposedRelease: null,
    });
  }

  return BottleClassificationDecisionSchema.parse({
    action: "create_bottle",
    rationale:
      "Server created the SMWS exact-cask bottle without agent reasoning because the SMWS code is the bottle identity anchor and no local bottle uses it.",
    candidateBottleIds,
    identityScope: "exact_cask",
    observation,
    identityBasis,
    confidenceBasis,
    matchedBottleId: null,
    matchedReleaseId: null,
    parentBottleId: null,
    proposedBottle: buildSmwsExactCaskBottleDraft({
      artifacts,
      code: smwsCode,
      reference,
    }),
    proposedRelease: null,
  });
}
