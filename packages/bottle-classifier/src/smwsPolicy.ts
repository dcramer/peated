import {
  BottleClassificationDecisionSchema,
  type BottleCandidate,
  type BottleClassificationDecision,
} from "./classifierTypes";
import type {
  BottleClassificationArtifacts,
  BottleReferenceInput,
} from "./contract";
import { getExactCaskCodeAnchor } from "./exactCask";
import {
  containsComparablePhrase,
  normalizeComparableText,
  textsOverlap,
} from "./identityEvidenceCore";
import { normalizeString } from "./normalize";
import { normalizeObservation } from "./observation";
import {
  composeExactCaskCodeFromComponents,
  parseReferenceName as parseSmwsReferenceName,
} from "./smws";

const BARE_SMWS_CODE_REFERENCE_PATTERN = /^SMWS\s+([A-Z]*\d+\.\d+)$/i;
const SMWS_REFERENCE_PATTERN = /\b(?:SMWS|Scotch Malt Whisky Society)\b/i;
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

function candidateLooksSmws(candidate: BottleCandidate): boolean {
  return (
    isSmwsIdentityAnchor(candidate.brand) ||
    isSmwsIdentityAnchor(candidate.bottler) ||
    textLooksSmws(candidate.reference) ||
    textLooksSmws(candidate.fullName)
  );
}

/** The SMWS code the source title prints or composes, read by closed syntax. */
export function getSourceSmwsCode(
  reference: Pick<BottleReferenceInput, "name">,
): string | null {
  return parseSmwsReferenceName(reference.name)?.code ?? null;
}

/** The SMWS codes a candidate carries in its cask number, name, or reference. */
export function getCandidateSmwsCodes(candidate: BottleCandidate): string[] {
  if (!candidateLooksSmws(candidate)) return [];
  return Array.from(
    new Set(
      [candidate.caskNumber, candidate.fullName, candidate.reference]
        .map((value) => getExactCaskCodeAnchor(value))
        .filter((code): code is string => code !== null),
    ),
  );
}

/**
 * SMWS identity rule (owner: Bottle classifier): an SMWS code names one cask.
 * When exactly one SMWS candidate carries the code the source title prints,
 * that candidate is the Bottle, with no model call. This never creates: a new
 * code goes to the agent, which writes the name.
 */
export function resolveSmwsExactCodeMatch({
  reference,
  candidates,
}: {
  reference: BottleReferenceInput;
  candidates: BottleCandidate[];
}): BottleClassificationDecision | null {
  const code = getSourceSmwsCode(reference);
  if (!code) return null;
  const bottleIds = Array.from(
    new Set(
      candidates
        .filter((candidate) => getCandidateSmwsCodes(candidate).includes(code))
        .map((candidate) => candidate.bottleId),
    ),
  );
  if (bottleIds.length !== 1) return null;
  return BottleClassificationDecisionSchema.parse({
    action: "match",
    rationale: `The source's SMWS code ${code} names one cask, and Bottle ${bottleIds[0]} is the only SMWS Bottle with that code.`,
    candidateBottleIds: bottleIds,
    identityScope: "exact_cask",
    observation: normalizeObservation({
      barrelNumber: null,
      selector: null,
      caskNumber: code,
    }),
    confidenceBasis: { unresolvedRisks: [], webEvidence: "not_needed" },
    matchedBottleId: bottleIds[0],
    proposedBottle: null,
  });
}

/**
 * True when the subtitle appears word for word in the source title, its label
 * reading, or captured search evidence, so the agent did not write it.
 */
export function smwsSubtitleIsPrinted({
  subtitle,
  reference,
  artifacts,
}: {
  subtitle: string;
  reference: BottleReferenceInput;
  artifacts: BottleClassificationArtifacts;
}): boolean {
  const needle = normalizeComparableText(subtitle);
  return [
    reference.name,
    artifacts.extractedIdentity?.expression,
    ...(artifacts.imageEvidence?.extractors.flatMap((extractor) =>
      extractor.textSpans.map((span) => span.text),
    ) ?? []),
    ...artifacts.searchEvidence.flatMap((evidence) => [
      evidence.summary,
      ...evidence.results.flatMap((result) => [
        result.title,
        result.description,
        ...result.extraSnippets,
      ]),
    ]),
  ].some((text) =>
    containsComparablePhrase(normalizeComparableText(text), needle),
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
  reference: BottleReferenceInput;
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
  reference: BottleReferenceInput;
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
    artifacts.extractedIdentity?.cask_number,
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

/**
 * Keeps an SMWS create in the identity model's shape: the code leads the name,
 * and the code lives in `caskNumber`, not `edition`. The agent writes the
 * subtitle; this never builds one from other text (Bottle classifier docs,
 * "SMWS Codes").
 */
export function normalizeSmwsExactCaskProposedBottleDraft({
  extractedIdentity,
  proposedBottle,
  reference,
}: {
  extractedIdentity: BottleClassificationArtifacts["extractedIdentity"];
  proposedBottle: NonNullable<BottleClassificationDecision["proposedBottle"]>;
  reference: BottleReferenceInput;
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
    getExactCaskCodeAnchor(extractedIdentity?.cask_number) ??
    getExactCaskCodeAnchor(proposedBottle.caskNumber) ??
    getExactCaskCodeAnchor(proposedBottle.edition) ??
    getExactCaskCodeAnchor(proposedBottle.name) ??
    getExactCaskCodeAnchor(reference.name);

  if (!smwsCode) {
    return proposedBottle;
  }

  const name = normalizeString(proposedBottle.name ?? "").trim();
  return {
    ...proposedBottle,
    name:
      getExactCaskCodeAnchor(name) === smwsCode || textsOverlap(name, smwsCode)
        ? name
        : `${smwsCode} ${name}`.trim(),
    caskNumber: smwsCode,
    edition: null,
  };
}
