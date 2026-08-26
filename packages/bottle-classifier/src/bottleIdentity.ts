/**
 * Pure exact-Bottle identity rules for materializing already extracted exact
 * traits.
 *
 * Keep this module structurally safe and brand-agnostic. If a decision depends
 * on marketed family meaning or producer-specific semantics, it belongs in the
 * reviewed classifier, not in these helpers. New hardcoded phrase rules need
 * verified whisky research and focused tests before being added here.
 */
import { z } from "zod";
import { normalizeBottle } from "./normalize";

export type BottleExactIdentityInput = {
  edition: string | null;
  statedAge: number | null;
  bottlingYear?: number | null;
  releaseYear: number | null;
  vintageYear: number | null;
  abv: number | null;
  singleCask: boolean | null;
  caskStrength: boolean | null;
  maturation?: string | null;
  caskNumber?: string | null;
  outturn?: number | null;
};

type BottleNameTraitsInput = Omit<BottleExactIdentityInput, "statedAge">;

type BottleNameIdentityInput = BottleNameInput & Partial<BottleNameTraitsInput>;

type BottleNameInput = {
  fullName: string | null | undefined;
  name: string | null | undefined;
  statedAge: number | null | undefined;
};

const BOTTLE_EXACT_IDENTITY_FIELDS = [
  "edition",
  "statedAge",
  "releaseYear",
  "vintageYear",
  "abv",
  "singleCask",
  "caskStrength",
] as const satisfies ReadonlyArray<keyof BottleExactIdentityInput>;

const BOTTLE_NAME_TRAIT_FIELDS = [
  "singleCask",
  "caskStrength",
] as const satisfies ReadonlyArray<keyof BottleNameTraitsInput>;

function bottleNameMarketsPattern(
  bottle: BottleNameInput,
  pattern: RegExp,
): boolean {
  return [bottle.name, bottle.fullName].some((name) => {
    const parsedName = z.string().safeParse(name);
    if (!parsedName.success) {
      return false;
    }

    return pattern.test(parsedName.data);
  });
}

function bottleNameMarketsTrait(
  bottle: BottleNameInput,
  field: (typeof BOTTLE_NAME_TRAIT_FIELDS)[number],
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

function isTraitAlreadyInBottleName({
  bottle,
  field,
  exact,
}: {
  bottle: BottleNameIdentityInput;
  field: (typeof BOTTLE_NAME_TRAIT_FIELDS)[number];
  exact: Partial<BottleExactIdentityInput>;
}) {
  return (
    bottle[field] === true &&
    exact[field] === true &&
    bottleNameMarketsTrait(bottle, field)
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

export function hasBottleStatedAgeConflict({
  bottle,
  exactStatedAge,
}: {
  bottle: BottleNameInput;
  exactStatedAge: number | null | undefined;
}) {
  return (
    bottle.statedAge !== null &&
    bottle.statedAge !== undefined &&
    exactStatedAge !== null &&
    exactStatedAge !== undefined &&
    bottle.statedAge !== exactStatedAge &&
    !bottleMarketsStatedAge(bottle)
  );
}

function formatExactIdentityLabel(
  field: (typeof BOTTLE_EXACT_IDENTITY_FIELDS)[number],
  value: NonNullable<
    BottleExactIdentityInput[(typeof BOTTLE_EXACT_IDENTITY_FIELDS)[number]]
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
 * Produces the canonical exact identity after accounting for bottle-level
 * stated-age carryover and shared-age conflicts.
 */
export function getResolvedBottleIdentity({
  bottle,
  exact,
}: {
  bottle: BottleNameInput;
  exact: BottleExactIdentityInput;
}): BottleExactIdentityInput {
  const statedAgeConflicts = hasBottleStatedAgeConflict({
    bottle,
    exactStatedAge: exact.statedAge,
  });

  return {
    edition: exact.edition ?? null,
    statedAge: statedAgeConflicts
      ? (exact.statedAge ?? null)
      : (bottle.statedAge ?? exact.statedAge ?? null),
    bottlingYear: exact.bottlingYear ?? null,
    releaseYear: exact.releaseYear ?? null,
    vintageYear: exact.vintageYear ?? null,
    abv: exact.abv ?? null,
    singleCask: exact.singleCask ?? null,
    caskStrength: exact.caskStrength ?? null,
    maturation: exact.maturation ?? null,
    caskNumber: exact.caskNumber ?? null,
    outturn: exact.outturn ?? null,
  };
}

export interface CanonicalBottleName {
  fullName: string;
  name: string;
}

export function formatCanonicalBottleName({
  bottleName,
  bottleFullName,
  bottleNameTraits,
  bottleStatedAge,
  exact,
}: {
  bottleName: string;
  bottleFullName: string;
  bottleNameTraits?: Partial<BottleNameTraitsInput>;
  bottleStatedAge: number | null;
  exact: BottleExactIdentityInput;
}): CanonicalBottleName {
  const resolvedIdentity = getResolvedBottleIdentity({
    bottle: {
      name: bottleName,
      fullName: bottleFullName,
      statedAge: bottleStatedAge,
    },
    exact,
  });

  const nameBits = [bottleName];
  const fullNameBits = [bottleFullName];

  for (const field of BOTTLE_EXACT_IDENTITY_FIELDS) {
    if (
      field === "releaseYear" &&
      editionIncludesReleaseYearEditionPhrase(resolvedIdentity)
    ) {
      continue;
    }

    if (
      field === "statedAge" &&
      resolvedIdentity.statedAge !== null &&
      ((bottleStatedAge !== null &&
        resolvedIdentity.statedAge === bottleStatedAge) ||
        bottleMarketsStatedAge({
          name: bottleName,
          fullName: bottleFullName,
          statedAge: resolvedIdentity.statedAge,
        }))
    ) {
      continue;
    }

    if (
      (field === "singleCask" || field === "caskStrength") &&
      isTraitAlreadyInBottleName({
        bottle: {
          name: bottleName,
          fullName: bottleFullName,
          statedAge: bottleStatedAge,
          ...bottleNameTraits,
        },
        field,
        exact: resolvedIdentity,
      })
    ) {
      continue;
    }

    const value = resolvedIdentity[field];
    if (value === null || value === undefined) {
      continue;
    }

    const label = formatExactIdentityLabel(field, value);
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
