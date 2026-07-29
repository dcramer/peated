/**
 * Pure exact-Bottle identity rules for materializing already extracted release
 * traits.
 *
 * Keep this module structurally safe and brand-agnostic. If a decision depends
 * on marketed family meaning or producer-specific semantics, it belongs in the
 * reviewed classifier, not in these helpers. New hardcoded phrase rules need
 * verified whisky research and focused tests before being added here.
 */
import { normalizeBottle } from "./normalize";

export type ReleaseIdentityInput = {
  edition: string | null;
  statedAge: number | null;
  releaseYear: number | null;
  vintageYear: number | null;
  abv: number | null;
  singleCask: boolean | null;
  caskStrength: boolean | null;
  caskType?: string | null;
  caskSize?: string | null;
  caskFill?: string | null;
};

type BottleLevelReleaseTraitsInput = Omit<ReleaseIdentityInput, "statedAge">;

type BottleReleaseIdentityBottleInput = BottleNameInput &
  Partial<BottleLevelReleaseTraitsInput>;

type BottleNameInput = {
  fullName: string | null | undefined;
  name: string | null | undefined;
  statedAge: number | null | undefined;
};

const RELEASE_IDENTITY_FIELDS = [
  "edition",
  "statedAge",
  "releaseYear",
  "vintageYear",
  "abv",
  "singleCask",
  "caskStrength",
  "caskType",
  "caskSize",
  "caskFill",
] as const satisfies ReadonlyArray<keyof ReleaseIdentityInput>;

const STABLE_BOTTLE_LEVEL_RELEASE_TRAIT_FIELDS = [
  "singleCask",
  "caskStrength",
] as const satisfies ReadonlyArray<keyof BottleLevelReleaseTraitsInput>;

function bottleNameMarketsPattern(
  bottle: BottleNameInput,
  pattern: RegExp,
): boolean {
  return [bottle.name, bottle.fullName].some((name) => {
    if (typeof name !== "string") {
      return false;
    }

    return pattern.test(name);
  });
}

function bottleMarketsInheritedReleaseTrait(
  bottle: BottleNameInput,
  field: (typeof STABLE_BOTTLE_LEVEL_RELEASE_TRAIT_FIELDS)[number],
): boolean {
  switch (field) {
    case "singleCask":
      return bottleNameMarketsPattern(
        bottle,
        /\b(single[-\s]+cask|single[-\s]+barrel)\b/i,
      );
    case "caskStrength":
      return bottleNameMarketsPattern(
        bottle,
        /\b(cask[-\s]+strength|barrel[-\s]+strength|barrel[-\s]+proof|full[-\s]+proof|natural[-\s]+strength|original[-\s]+strength|undiluted|cask[-\s]+bottling)\b/i,
      );
  }
}

function isInheritedBottleLevelReleaseTrait({
  bottle,
  field,
  release,
}: {
  bottle: BottleReleaseIdentityBottleInput;
  field: (typeof STABLE_BOTTLE_LEVEL_RELEASE_TRAIT_FIELDS)[number];
  release: Partial<ReleaseIdentityInput>;
}) {
  return (
    bottle[field] === true &&
    release[field] === true &&
    bottleMarketsInheritedReleaseTrait(bottle, field)
  );
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
    .match(new RegExp(`\\b${statedAge}-year-old\\b`, "i"))
    ? true
    : false;
}

export function bottleMarketsStatedAge(bottle: BottleNameInput) {
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
  bottle: BottleNameInput;
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
    default:
      return null;
  }
}

function editionIncludesReleaseYearEditionPhrase({
  edition,
  releaseYear,
}: {
  edition: string | null;
  releaseYear: number | null;
}) {
  if (!edition || releaseYear === null) {
    return false;
  }

  return new RegExp(
    `(?:^|[^A-Za-z0-9])${releaseYear}\\s+Edition(?:[^A-Za-z0-9]|$)`,
    "i",
  ).test(edition);
}

/**
 * Produces the canonical release identity after accounting for bottle-level
 * stated-age carryover and dirty-parent conflicts.
 */
export function getResolvedReleaseIdentity({
  bottle,
  release,
}: {
  bottle: BottleNameInput;
  release: ReleaseIdentityInput;
}): ReleaseIdentityInput {
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
    caskType: release.caskType ?? null,
    caskSize: release.caskSize ?? null,
    caskFill: release.caskFill ?? null,
  };
}

export function formatCanonicalReleaseName({
  bottleName,
  bottleFullName,
  bottleReleaseTraits,
  bottleStatedAge,
  release,
}: {
  bottleName: string;
  bottleFullName: string;
  bottleReleaseTraits?: Partial<BottleLevelReleaseTraitsInput>;
  bottleStatedAge: number | null;
  release: ReleaseIdentityInput;
}): {
  fullName: string;
  name: string;
} {
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
    if (
      field === "releaseYear" &&
      editionIncludesReleaseYearEditionPhrase(resolvedRelease)
    ) {
      continue;
    }

    if (
      field === "statedAge" &&
      resolvedRelease.statedAge !== null &&
      ((bottleStatedAge !== null &&
        resolvedRelease.statedAge === bottleStatedAge) ||
        bottleMarketsStatedAge({
          name: bottleName,
          fullName: bottleFullName,
          statedAge: resolvedRelease.statedAge,
        }))
    ) {
      continue;
    }

    if (
      (field === "singleCask" || field === "caskStrength") &&
      isInheritedBottleLevelReleaseTrait({
        bottle: {
          name: bottleName,
          fullName: bottleFullName,
          statedAge: bottleStatedAge,
          ...bottleReleaseTraits,
        },
        field,
        release: resolvedRelease,
      })
    ) {
      continue;
    }

    const value = resolvedRelease[field];
    if (value === null || value === undefined) {
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
