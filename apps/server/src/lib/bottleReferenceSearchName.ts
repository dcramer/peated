import {
  normalizeBottleBatchNumber,
  normalizeString,
} from "@peated/bottle-classifier/normalize";

export type BottleReferenceSearchSignals = {
  edition: string | null;
  releaseYear: number | null;
  statedAge: number | null;
  vintageYear: number | null;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildLooseEditionPattern(edition: string) {
  const normalizedEdition = normalizeBottleBatchNumber(
    normalizeString(edition),
  ).trim();
  const releaseNoMatch = normalizedEdition.match(
    /^Release\s+No\.?\s+([A-Za-z0-9.-]+)$/i,
  );

  if (releaseNoMatch) {
    return `Release\\s+No\\.?\\s+${escapeRegExp(releaseNoMatch[1])}`;
  }

  const bareNoMatch = normalizedEdition.match(/^No\.?\s+([A-Za-z0-9.-]+)$/i);

  if (bareNoMatch) {
    return `(?:Release\\s+)?No\\.?\\s+${escapeRegExp(bareNoMatch[1])}`;
  }

  const volumeMatch = normalizedEdition.match(
    /^Vol(?:ume)?\.?\s+([A-Za-z0-9IVXLCM.-]+)$/i,
  );

  if (volumeMatch) {
    return `Vol(?:ume)?\\.?\\s+${escapeRegExp(volumeMatch[1])}`;
  }

  return escapeRegExp(normalizedEdition).replace(/\\ /g, "\\s+");
}

export function stripReleaseIdentityFromSearchName(
  name: string,
  signals: BottleReferenceSearchSignals,
) {
  let strippedName = normalizeString(name);

  if (signals.edition) {
    const editionPattern = buildLooseEditionPattern(signals.edition);

    strippedName = strippedName
      .replace(new RegExp(`\\s*\\(${editionPattern}\\)\\s*$`, "i"), " ")
      .replace(new RegExp(`\\b${editionPattern}\\b`, "i"), " ");
  }

  if (signals.statedAge !== null) {
    strippedName = strippedName.replace(
      new RegExp(`\\b${signals.statedAge}-year-old\\b`, "i"),
      " ",
    );
  }

  if (signals.releaseYear !== null) {
    strippedName = strippedName
      .replace(new RegExp(`\\b${signals.releaseYear}\\s+release\\b`, "i"), " ")
      .replace(new RegExp(`\\b${signals.releaseYear}\\b`, "i"), " ");
  }

  if (signals.vintageYear !== null) {
    strippedName = strippedName
      .replace(new RegExp(`\\b${signals.vintageYear}\\s+vintage\\b`, "i"), " ")
      .replace(new RegExp(`\\b${signals.vintageYear}\\b`, "i"), " ");
  }

  return strippedName
    .replace(/\s{2,}/g, " ")
    .replace(/\s*[-,(]+\s*$/g, "")
    .trim();
}
