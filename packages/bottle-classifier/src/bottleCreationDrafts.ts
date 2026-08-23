import type { ProposedBottle } from "./classifierTypes";
import {
  normalizeBottle,
  normalizeString,
  stripDuplicateBrandPrefixFromBottleName,
} from "./normalize";

interface BottleNameWithAbv {
  name: string;
  abv: number | null;
}

function extractExplicitAbvFromBottleName(name: string): BottleNameWithAbv {
  let abv: number | null = null;
  // Keep ABV out of canonical names, but do not strip arbitrary low percentages.
  const captureAbv = (value: string, requiresPlausibleRange = false) => {
    const numericValue = Number(value);
    if (requiresPlausibleRange && (numericValue < 30 || numericValue > 75)) {
      return false;
    }
    abv ??= numericValue;
    return true;
  };
  const normalizedName = name
    .replace(
      /\s*[[(]\s*(\d{1,2}(?:\.\d+)?)\s?%\s*(ABV|alc\.?(?:\/vol\.?)?)?\s*[\])]/gi,
      (_match, value: string, marker: string | undefined) => {
        if (!captureAbv(value, !marker)) {
          return _match;
        }
        return " ";
      },
    )
    .replace(
      /(^|[\s,;-]+)(\d{1,2}(?:\.\d+)?)\s?%\s*(ABV|alc\.?(?:\/vol\.?)?)?(?=$|[\s,;)])/gi,
      (_match, prefix: string, value: string, marker: string | undefined) => {
        if (!captureAbv(value, !marker)) {
          return _match;
        }
        return prefix.trim() ? prefix : " ";
      },
    )
    .replace(/\s+([,;)])/g, "$1")
    .replace(/[(,;]\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    name: normalizedName || name,
    abv,
  };
}

/**
 * Normalizes proposed bottle identity while keeping explicit ABV out of names.
 */
export function normalizeProposedBottleDraft(
  proposedBottle: ProposedBottle,
): ProposedBottle {
  const distillersByName = new Map<
    string,
    ProposedBottle["distillers"][number]
  >();
  for (const distiller of proposedBottle.distillers) {
    const normalizedDistillerName = normalizeString(
      distiller.name,
    ).toLowerCase();
    if (!normalizedDistillerName) {
      continue;
    }

    const existing = distillersByName.get(normalizedDistillerName);
    if (!existing || (existing.id === null && distiller.id !== null)) {
      distillersByName.set(normalizedDistillerName, distiller);
    }
  }

  const nameWithoutExplicitAbv = extractExplicitAbvFromBottleName(
    proposedBottle.name,
  );
  const normalized = normalizeBottle({
    name: stripDuplicateBrandPrefixFromBottleName(
      nameWithoutExplicitAbv.name,
      proposedBottle.brand.name,
    ),
    statedAge: proposedBottle.statedAge,
    vintageYear: proposedBottle.vintageYear,
    releaseYear: proposedBottle.releaseYear,
    caskStrength: proposedBottle.caskStrength,
    singleCask: proposedBottle.singleCask,
    isFullName: false,
  });

  return {
    ...proposedBottle,
    name: normalized.name,
    statedAge: normalized.statedAge,
    vintageYear: normalized.vintageYear,
    releaseYear: normalized.releaseYear,
    caskStrength: normalized.caskStrength ?? null,
    singleCask: normalized.singleCask ?? null,
    distillers: Array.from(distillersByName.values()),
    abv: proposedBottle.abv ?? nameWithoutExplicitAbv.abv,
    bottler: proposedBottle.bottler,
  };
}
