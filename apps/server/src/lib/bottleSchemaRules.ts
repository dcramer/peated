import type { Bottle, BottleRelease } from "@peated/server/db/schema";
import { normalizeBottle } from "./normalize";

export type ReleaseIdentityInput = Pick<
  BottleRelease,
  | "abv"
  | "caskFill"
  | "caskSize"
  | "caskStrength"
  | "caskType"
  | "edition"
  | "releaseYear"
  | "singleCask"
  | "statedAge"
  | "vintageYear"
>;

export type BottleLevelReleaseTraitsInput = Pick<
  Bottle,
  | "abv"
  | "caskFill"
  | "caskSize"
  | "caskStrength"
  | "caskType"
  | "edition"
  | "releaseYear"
  | "singleCask"
  | "vintageYear"
>;

type ExtractedReleaseIdentityInput = {
  stated_age: number | null;
  edition: string | null;
  abv: number | null;
  release_year: number | null;
  vintage_year: number | null;
  cask_type: string | null;
  cask_size: string | null;
  cask_fill: string | null;
  cask_strength: boolean | null;
  single_cask: boolean | null;
};

export const BOTTLE_SCHEMA_RULES = {
  bottleIdentity:
    "Bottle identity is the stable parent product and the default object for tasting, search, and collection. Brand, bottler, distillery, expression/name, series, and category belong here. When only one marketed form is known, the bottle may temporarily carry release-like traits until a reusable child release is warranted.",
  releaseIdentity:
    "Release identity is optional and only exists under a bottle when the differentiator should aggregate across users, searches, prices, and stats. Edition, ABV, years, single-cask, cask-strength, and cask details belong here.",
  observationPolicy:
    "Exact source facts like cask numbers, bottle numbers, outturns, exclusives, and raw maturation wording should be preserved as observations first. Promote them to canonical release identity only when they are clearly part of the marketed release.",
  aliasPolicy:
    "Retailer listing aliases are bottle-level evidence unless they exactly match a canonical release alias.",
} as const;

export const DEFAULT_BOTTLE_CREATION_TARGET = "bottle" as const;
export const DEFAULT_PRICE_MATCH_CREATION_TARGET =
  DEFAULT_BOTTLE_CREATION_TARGET;

export const RELEASE_IDENTITY_FIELDS = [
  "edition",
  "statedAge",
  "releaseYear",
  "vintageYear",
  "abv",
  "singleCask",
  "caskStrength",
  "caskFill",
  "caskType",
  "caskSize",
] as const satisfies ReadonlyArray<keyof ReleaseIdentityInput>;

export const BOTTLE_LEVEL_RELEASE_TRAIT_FIELDS = [
  "edition",
  "releaseYear",
  "vintageYear",
  "abv",
  "singleCask",
  "caskStrength",
  "caskFill",
  "caskType",
  "caskSize",
] as const satisfies ReadonlyArray<keyof BottleLevelReleaseTraitsInput>;

export const EXTRACTED_RELEASE_IDENTITY_FIELDS = [
  "edition",
  "stated_age",
  "abv",
  "release_year",
  "vintage_year",
  "cask_type",
  "cask_size",
  "cask_fill",
  "cask_strength",
  "single_cask",
] as const satisfies ReadonlyArray<keyof ExtractedReleaseIdentityInput>;

function formatReleaseEnum(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getReleaseObservationFacts(
  release: Partial<ReleaseIdentityInput>,
) {
  return Object.fromEntries(
    Object.entries({
      edition: release.edition ?? null,
      statedAge: release.statedAge ?? null,
      releaseYear: release.releaseYear ?? null,
      vintageYear: release.vintageYear ?? null,
      abv: release.abv ?? null,
      singleCask: release.singleCask ?? null,
      caskStrength: release.caskStrength ?? null,
      caskFill: release.caskFill ?? null,
      caskType: release.caskType ?? null,
      caskSize: release.caskSize ?? null,
    }).filter(([, value]) => value !== null && value !== undefined),
  );
}

export function getBottleLevelReleaseTraits(
  bottle: Partial<BottleLevelReleaseTraitsInput>,
) {
  return Object.fromEntries(
    Object.entries({
      edition: bottle.edition ?? null,
      releaseYear: bottle.releaseYear ?? null,
      vintageYear: bottle.vintageYear ?? null,
      abv: bottle.abv ?? null,
      singleCask: bottle.singleCask ?? null,
      caskStrength: bottle.caskStrength ?? null,
      caskFill: bottle.caskFill ?? null,
      caskType: bottle.caskType ?? null,
      caskSize: bottle.caskSize ?? null,
    }).filter(([, value]) => value !== null && value !== undefined),
  );
}

export function hasBottleLevelReleaseTraits(
  bottle: Partial<BottleLevelReleaseTraitsInput>,
) {
  return Object.keys(getBottleLevelReleaseTraits(bottle)).length > 0;
}

function nameMarketsStatedAge({
  name,
  statedAge,
}: {
  name: string | null | undefined;
  statedAge: number | null | undefined;
}) {
  if (!name || statedAge === null || statedAge === undefined) {
    return false;
  }

  return normalizeBottle({
    name,
    statedAge,
  })
    .name.toLowerCase()
    .includes(`${statedAge}-year-old`);
}

export function bottleMarketsStatedAge(
  bottle: Pick<Bottle, "fullName" | "name" | "statedAge">,
) {
  if (bottle.statedAge === null || bottle.statedAge === undefined) {
    return false;
  }

  return [bottle.name, bottle.fullName].some((name) =>
    nameMarketsStatedAge({
      name,
      statedAge: bottle.statedAge,
    }),
  );
}

export function hasDirtyBottleLevelStatedAgeConflict({
  bottle,
  releaseStatedAge,
}: {
  bottle: Pick<Bottle, "fullName" | "name" | "statedAge">;
  releaseStatedAge: number | null | undefined;
}) {
  return (
    bottle.statedAge !== null &&
    bottle.statedAge !== undefined &&
    releaseStatedAge !== null &&
    releaseStatedAge !== undefined &&
    bottle.statedAge !== releaseStatedAge &&
    !bottleMarketsStatedAge(bottle)
  );
}

export function isAddingBottleLevelReleaseTraits({
  current,
  next,
}: {
  current: Partial<BottleLevelReleaseTraitsInput>;
  next: Partial<BottleLevelReleaseTraitsInput>;
}) {
  return BOTTLE_LEVEL_RELEASE_TRAIT_FIELDS.some((field) => {
    const nextValue = next[field];
    if (nextValue === null || nextValue === undefined) {
      return false;
    }
    return nextValue !== current[field];
  });
}

function formatReleaseTraitLabel(
  field: (typeof RELEASE_IDENTITY_FIELDS)[number],
  value: NonNullable<
    ReleaseIdentityInput[(typeof RELEASE_IDENTITY_FIELDS)[number]]
  >,
): string | null {
  switch (field) {
    case "edition":
      return `${value}`;
    case "statedAge":
      return `${value}-year-old`;
    case "releaseYear":
      return `${value} Release`;
    case "vintageYear":
      return `${value} Vintage`;
    case "abv":
      return `${Number(value).toFixed(1)}% ABV`;
    case "singleCask":
      return value ? "Single Cask" : null;
    case "caskStrength":
      return value ? "Cask Strength" : null;
    case "caskFill":
    case "caskType":
    case "caskSize":
      return formatReleaseEnum(`${value}`);
    default:
      return null;
  }
}

export function getResolvedReleaseIdentity({
  bottle,
  release,
}: {
  bottle: Pick<Bottle, "fullName" | "name" | "statedAge">;
  release: ReleaseIdentityInput;
}): ReleaseIdentityInput {
  // When a marketed age lives on the parent bottle, it is part of the stable
  // expression identity and should not be duplicated as a release-only suffix.
  const hasDirtyParentStatedAgeConflict = hasDirtyBottleLevelStatedAgeConflict({
    bottle,
    releaseStatedAge: release.statedAge,
  });

  return {
    edition: release.edition ?? null,
    statedAge: hasDirtyParentStatedAgeConflict
      ? (release.statedAge ?? null)
      : (bottle.statedAge ?? release.statedAge ?? null),
    releaseYear: release.releaseYear ?? null,
    vintageYear: release.vintageYear ?? null,
    abv: release.abv ?? null,
    singleCask: release.singleCask ?? null,
    caskStrength: release.caskStrength ?? null,
    caskFill: release.caskFill ?? null,
    caskType: release.caskType ?? null,
    caskSize: release.caskSize ?? null,
  };
}

export function formatCanonicalReleaseName({
  bottleName,
  bottleFullName,
  bottleStatedAge,
  release,
}: {
  bottleName: string;
  bottleFullName: string;
  bottleStatedAge: number | null;
  release: ReleaseIdentityInput;
}): {
  fullName: string;
  name: string;
} {
  // Canonical release names are built from typed identity fields instead of raw
  // label text so duplicate checks and aliases stay consistent across sources.
  const resolvedRelease = getResolvedReleaseIdentity({
    bottle: {
      name: bottleName,
      fullName: bottleFullName,
      statedAge: bottleStatedAge,
    },
    release,
  });

  const nameBits = [bottleName];
  const fullNameBits = [bottleFullName];

  for (const field of RELEASE_IDENTITY_FIELDS) {
    // The bottle already owns its marketed age, so only release-specific ages
    // should appear in the generated suffix.
    if (
      field === "statedAge" &&
      bottleStatedAge !== null &&
      resolvedRelease.statedAge === bottleStatedAge
    ) {
      continue;
    }

    const value = resolvedRelease[field];
    if (value === null) {
      continue;
    }

    const label = formatReleaseTraitLabel(field, value);
    if (!label) {
      continue;
    }

    nameBits.push(label);
    fullNameBits.push(label);
  }

  return {
    name: nameBits.join(" - "),
    fullName: fullNameBits.join(" - "),
  };
}

export function doesStoreListingAliasIdentifyRelease({
  aliasName,
  canonicalReleaseFullName,
}: {
  aliasName: string;
  canonicalReleaseFullName: string;
}): boolean {
  return (
    aliasName.trim().toLowerCase() ===
    canonicalReleaseFullName.trim().toLowerCase()
  );
}

export function getCanonicalReleaseAliasNames({
  fullName,
}: {
  fullName: string;
}): string[] {
  return [fullName];
}

export function hasExtractedReleaseIdentity(
  extractedLabel: ExtractedReleaseIdentityInput | null,
): boolean {
  if (!extractedLabel) {
    return false;
  }

  return EXTRACTED_RELEASE_IDENTITY_FIELDS.some((field) => {
    const value = extractedLabel[field];
    if (typeof value === "string") {
      return value.length > 0;
    }

    return value !== null;
  });
}
