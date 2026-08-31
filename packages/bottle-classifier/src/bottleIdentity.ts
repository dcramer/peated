/**
 * Pure exact-Bottle identity rules for materializing already extracted exact
 * traits.
 *
 * Keep this module structurally safe and brand-agnostic. If a decision depends
 * on marketed family meaning or producer-specific semantics, it belongs in the
 * reviewed classifier, not in these helpers. A documented closed identifier
 * syntax can own identity when its exact fields agree. New hardcoded phrase
 * rules need verified whisky research and focused tests before being added here.
 */
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

type BottleNameInput = {
  fullName: string | null | undefined;
  name: string | null | undefined;
  statedAge: number | null | undefined;
};

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

function nameIncludesEdition(name: string, edition: string) {
  const escapedEdition = edition.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `(?:^|[^A-Za-z0-9])${escapedEdition}(?:[^A-Za-z0-9]|$)`,
    "i",
  ).test(name);
}

export function formatCanonicalBottleName({
  bottleName,
  bottleFullName,
  edition,
}: {
  bottleName: string;
  bottleFullName: string;
  edition: string | null;
}): CanonicalBottleName {
  const releaseName = edition?.trim();
  if (!releaseName || nameIncludesEdition(bottleName, releaseName)) {
    return {
      name: bottleName,
      fullName: bottleFullName,
    };
  }

  return {
    name: `${bottleName} - ${releaseName}`,
    fullName: `${bottleFullName} - ${releaseName}`,
  };
}
