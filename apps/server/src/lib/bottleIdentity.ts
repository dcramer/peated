import { formatCanonicalBottleName } from "@peated/bottle-classifier/bottleIdentity";
import type { Bottle, BottleGroup } from "@peated/server/db/schema";
import { toTitleCase } from "@peated/server/lib/strings";

type StableBottleIdentity = Pick<
  BottleGroup,
  "name" | "fullName" | "statedAge"
>;

type MaterializedBottleIdentity = Pick<
  Bottle,
  "name" | "fullName" | "statedAge"
>;

export type BottleExactIdentity = Pick<
  Bottle,
  | "edition"
  | "statedAge"
  | "releaseYear"
  | "vintageYear"
  | "abv"
  | "singleCask"
  | "caskStrength"
  | "caskType"
  | "caskSize"
  | "caskFill"
>;

export type BottleExactIdentityPatch = Partial<BottleExactIdentity>;

export type BottleGroupMaterialization = Pick<
  BottleGroup,
  | "name"
  | "fullName"
  | "statedAge"
  | "brandId"
  | "bottlerId"
  | "seriesId"
  | "category"
  | "flavorProfile"
>;

export type MaterializedBottleForGroup = Pick<
  Bottle,
  | "name"
  | "fullName"
  | "statedAge"
  | "brandId"
  | "bottlerId"
  | "seriesId"
  | "category"
  | "flavorProfile"
>;

function valueOrCurrent<T>(value: T | undefined, current: T): T {
  return value === undefined ? current : value;
}

/** Returns only a non-redundant exact age relative to the shared age. */
export function getBottleExactStatedAge({
  bottleStatedAge,
  stableStatedAge,
}: {
  bottleStatedAge: number | null;
  stableStatedAge: number | null;
}) {
  return bottleStatedAge !== null && bottleStatedAge !== stableStatedAge
    ? bottleStatedAge
    : null;
}

/** Applies an exact patch while classifying age against the source group. */
export function getBottleExactIdentity({
  bottle,
  sourceGroupStatedAge,
  exactPatch,
}: {
  bottle: BottleExactIdentity;
  sourceGroupStatedAge: number | null;
  exactPatch?: BottleExactIdentityPatch;
}): BottleExactIdentity {
  return {
    edition: valueOrCurrent(exactPatch?.edition, bottle.edition),
    statedAge: getBottleExactStatedAge({
      bottleStatedAge: valueOrCurrent(exactPatch?.statedAge, bottle.statedAge),
      stableStatedAge: sourceGroupStatedAge,
    }),
    releaseYear: valueOrCurrent(exactPatch?.releaseYear, bottle.releaseYear),
    vintageYear: valueOrCurrent(exactPatch?.vintageYear, bottle.vintageYear),
    abv: valueOrCurrent(exactPatch?.abv, bottle.abv),
    singleCask: valueOrCurrent(exactPatch?.singleCask, bottle.singleCask),
    caskStrength: valueOrCurrent(exactPatch?.caskStrength, bottle.caskStrength),
    caskType: valueOrCurrent(exactPatch?.caskType, bottle.caskType),
    caskSize: valueOrCurrent(exactPatch?.caskSize, bottle.caskSize),
    caskFill: valueOrCurrent(exactPatch?.caskFill, bottle.caskFill),
  };
}

function formatExactCaskIdentity({
  fullName,
  name,
  caskType,
  caskSize,
  caskFill,
}: {
  fullName: string;
  name: string;
  caskType: string | null | undefined;
  caskSize: string | null | undefined;
  caskFill: string | null | undefined;
}) {
  const caskBits = [
    caskType ? `${toTitleCase(caskType)} Cask` : null,
    caskSize ? toTitleCase(caskSize) : null,
    caskFill
      ? caskFill === "other"
        ? "Other Fill"
        : toTitleCase(caskFill)
      : null,
  ].filter((value): value is string => value !== null);

  if (!caskBits.length) {
    return { fullName, name };
  }

  return {
    fullName: [fullName, ...caskBits].join(" - "),
    name: [name, ...caskBits].join(" - "),
  };
}

/** Materializes the complete exact identity without retaining redundant age overrides. */
export function materializeBottleIdentity({
  stable,
  exact,
}: {
  stable: StableBottleIdentity;
  exact: BottleExactIdentity;
}): MaterializedBottleIdentity {
  const exactStatedAge = getBottleExactStatedAge({
    bottleStatedAge: exact.statedAge,
    stableStatedAge: stable.statedAge,
  });
  const identity = formatExactCaskIdentity({
    ...formatCanonicalBottleName({
      bottleName: stable.name,
      bottleFullName: stable.fullName,
      bottleNameTraits: {
        caskStrength: exact.caskStrength,
        singleCask: exact.singleCask,
      },
      bottleStatedAge: stable.statedAge,
      exact: {
        ...exact,
        statedAge: exactStatedAge,
      },
    }),
    caskType: exact.caskType,
    caskSize: exact.caskSize,
    caskFill: exact.caskFill,
  });

  return {
    ...identity,
    statedAge: exactStatedAge ?? stable.statedAge,
  };
}

/** Materializes only the durable Bottle fields owned by shared group identity. */
export function materializeBottleForGroup({
  group,
  exact,
}: {
  group: BottleGroupMaterialization;
  exact: BottleExactIdentity;
}): MaterializedBottleForGroup {
  return {
    ...materializeBottleIdentity({ stable: group, exact }),
    brandId: group.brandId,
    bottlerId: group.bottlerId,
    seriesId: group.seriesId,
    category: group.category,
    flavorProfile: group.flavorProfile,
  };
}
