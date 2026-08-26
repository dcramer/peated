import { formatCanonicalBottleName } from "@peated/bottle-classifier/bottleIdentity";
import type { Bottle, BottleGroup } from "@peated/server/db/schema";

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
  | "maturation"
  | "caskNumber"
  | "outturn"
> & {
  bottlingYear?: Bottle["bottlingYear"];
  noAgeStatement?: Bottle["noAgeStatement"];
};

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
    noAgeStatement: valueOrCurrent(
      exactPatch?.noAgeStatement,
      bottle.noAgeStatement,
    ),
    bottlingYear: valueOrCurrent(exactPatch?.bottlingYear, bottle.bottlingYear),
    releaseYear: valueOrCurrent(exactPatch?.releaseYear, bottle.releaseYear),
    vintageYear: valueOrCurrent(exactPatch?.vintageYear, bottle.vintageYear),
    abv: valueOrCurrent(exactPatch?.abv, bottle.abv),
    singleCask: valueOrCurrent(exactPatch?.singleCask, bottle.singleCask),
    caskStrength: valueOrCurrent(exactPatch?.caskStrength, bottle.caskStrength),
    maturation: valueOrCurrent(exactPatch?.maturation, bottle.maturation),
    caskNumber: valueOrCurrent(exactPatch?.caskNumber, bottle.caskNumber),
    outturn: valueOrCurrent(exactPatch?.outturn, bottle.outturn),
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
  const hasNoAgeStatement = exact.noAgeStatement === true;
  const exactStatedAge = hasNoAgeStatement
    ? null
    : getBottleExactStatedAge({
        bottleStatedAge: exact.statedAge,
        stableStatedAge: stable.statedAge,
      });
  const identity = formatCanonicalBottleName({
    bottleName: stable.name,
    bottleFullName: stable.fullName,
    bottleNameTraits: {
      caskStrength: exact.caskStrength,
      singleCask: exact.singleCask,
    },
    bottleStatedAge: hasNoAgeStatement ? null : stable.statedAge,
    exact: {
      ...exact,
      statedAge: exactStatedAge,
    },
  });

  return {
    ...identity,
    statedAge: hasNoAgeStatement ? null : (exactStatedAge ?? stable.statedAge),
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
