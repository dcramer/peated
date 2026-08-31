import { normalizeBottleReferenceKey } from "@peated/server/lib/normalize";

export const BOTTLE_REFERENCE_AUDIT_SIGNALS = [
  "smws_conflict",
  "age_conflict",
  "vintage_year_conflict",
  "release_year_conflict",
  "abv_conflict",
  "edition_conflict",
  "cask_conflict",
  "normalized_overlap",
  "generic_prefix",
  "sibling_ambiguity",
] as const;

export type BottleReferenceAuditSignalKind =
  (typeof BOTTLE_REFERENCE_AUDIT_SIGNALS)[number];

export type BottleReferenceAuditSignal = {
  kind: BottleReferenceAuditSignalKind;
  message: string;
  candidateBottleIds: number[];
};

export type ReferenceAuditBottle = {
  id: number;
  fullName: string;
  statedAge: number | null;
  abv: number | null;
  vintageYear: number | null;
  releaseYear: number | null;
  edition: string | null;
  caskNumber: string | null;
};

function firstMatch(text: string, pattern: RegExp) {
  return pattern.exec(text)?.[1] ?? null;
}

function smwsCode(text: string) {
  return firstMatch(text, /(?:\bSMWS\s+|^)(\d{1,3}\.\d{1,3})(?=\s|$)/i);
}

function statedAge(text: string) {
  const value = firstMatch(text, /\b(\d{1,3})[ -]?(?:year|yr)s?[ -]?old\b/i);
  return value === null ? null : Number(value);
}

function abv(text: string) {
  const value = firstMatch(text, /\b(\d{1,2}(?:\.\d+)?)\s*%\s*(?:ABV)?\b/i);
  return value === null ? null : Number(value);
}

function vintageYear(text: string) {
  const value = firstMatch(
    text,
    /\b(?:vintage|distilled(?:\s+in)?)\s+(18\d{2}|19\d{2}|20\d{2})\b/i,
  );
  return value === null ? null : Number(value);
}

function releaseYear(text: string) {
  const value = firstMatch(text, /\b(18\d{2}|19\d{2}|20\d{2})\s+release\b/i);
  return value === null ? null : Number(value);
}

function caskNumber(text: string) {
  return firstMatch(
    text,
    /\b(?:cask|barrel)(?:\s+(?:no\.?|number))?\s*#?\s*([a-z0-9][a-z0-9./-]*)\b/i,
  );
}

function edition(text: string) {
  return (
    firstMatch(
      text,
      /\bedition\s+([a-z0-9][a-z0-9 -]*?)(?:[,()]|$)/i,
    )?.trim() ?? null
  );
}

function comparisonKey(value: string) {
  return normalizeBottleReferenceKey(value).toLowerCase();
}

function signal(
  kind: BottleReferenceAuditSignalKind,
  message: string,
  candidateBottleIds: number[] = [],
): BottleReferenceAuditSignal {
  return { kind, message, candidateBottleIds };
}

/** Computes evidence only. Callers own all review and mutation decisions. */
export function getBottleReferenceAuditSignals({
  referenceName,
  bottle,
  siblings,
  normalizedOverlapNames = [],
}: {
  referenceName: string;
  bottle: ReferenceAuditBottle;
  siblings: ReferenceAuditBottle[];
  normalizedOverlapNames?: string[];
}) {
  const signals: BottleReferenceAuditSignal[] = [];
  const referenceCode = smwsCode(referenceName);
  const bottleCode = smwsCode(bottle.fullName);
  if (referenceCode && bottleCode && referenceCode !== bottleCode) {
    signals.push(
      signal(
        "smws_conflict",
        `Reference code ${referenceCode} conflicts with Bottle code ${bottleCode}.`,
      ),
    );
  }

  const referenceAge = statedAge(referenceName);
  if (
    referenceAge !== null &&
    bottle.statedAge !== null &&
    referenceAge !== bottle.statedAge
  ) {
    signals.push(
      signal(
        "age_conflict",
        `Reference age ${referenceAge} conflicts with Bottle age ${bottle.statedAge}.`,
      ),
    );
  }
  const referenceAbv = abv(referenceName);
  if (
    referenceAbv !== null &&
    bottle.abv !== null &&
    Math.abs(referenceAbv - bottle.abv) >= 0.05
  ) {
    signals.push(
      signal(
        "abv_conflict",
        `Reference ABV ${referenceAbv}% conflicts with Bottle ABV ${bottle.abv}%.`,
      ),
    );
  }
  const referenceVintage = vintageYear(referenceName);
  if (
    referenceVintage !== null &&
    bottle.vintageYear !== null &&
    referenceVintage !== bottle.vintageYear
  ) {
    signals.push(
      signal(
        "vintage_year_conflict",
        `Reference vintage ${referenceVintage} conflicts with Bottle vintage ${bottle.vintageYear}.`,
      ),
    );
  }
  const referenceRelease = releaseYear(referenceName);
  if (
    referenceRelease !== null &&
    bottle.releaseYear !== null &&
    referenceRelease !== bottle.releaseYear
  ) {
    signals.push(
      signal(
        "release_year_conflict",
        `Reference release ${referenceRelease} conflicts with Bottle release ${bottle.releaseYear}.`,
      ),
    );
  }
  const referenceCask = caskNumber(referenceName);
  if (
    referenceCask &&
    bottle.caskNumber &&
    comparisonKey(referenceCask) !== comparisonKey(bottle.caskNumber)
  ) {
    signals.push(
      signal(
        "cask_conflict",
        `Reference cask ${referenceCask} conflicts with Bottle cask ${bottle.caskNumber}.`,
      ),
    );
  }
  const referenceEdition = edition(referenceName);
  if (
    referenceEdition &&
    bottle.edition &&
    comparisonKey(referenceEdition) !== comparisonKey(bottle.edition)
  ) {
    signals.push(
      signal(
        "edition_conflict",
        `Reference edition ${referenceEdition} conflicts with Bottle edition ${bottle.edition}.`,
      ),
    );
  }

  if (normalizedOverlapNames.length) {
    signals.push(
      signal(
        "normalized_overlap",
        `Equivalent reference evidence exists: ${normalizedOverlapNames.join(", ")}.`,
      ),
    );
  }

  const referenceKey = comparisonKey(referenceName);
  const prefixCandidates = [bottle, ...siblings].filter(({ fullName }) => {
    const fullNameKey = comparisonKey(fullName);
    return (
      fullNameKey !== referenceKey && fullNameKey.startsWith(`${referenceKey} `)
    );
  });
  if (prefixCandidates.length) {
    signals.push(
      signal(
        "generic_prefix",
        "The reference is a prefix of one or more Bottle names.",
        prefixCandidates.map(({ id }) => id),
      ),
    );
  }

  const plausibleSiblings = siblings.filter(({ fullName }) => {
    const siblingKey = comparisonKey(fullName);
    return (
      siblingKey.startsWith(referenceKey) || referenceKey.startsWith(siblingKey)
    );
  });
  if (plausibleSiblings.length) {
    signals.push(
      signal(
        "sibling_ambiguity",
        "The reference does not distinguish this Bottle from a sibling.",
        plausibleSiblings.map(({ id }) => id),
      ),
    );
  }

  return signals;
}
