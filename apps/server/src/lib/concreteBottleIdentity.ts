import { formatCanonicalReleaseName } from "@peated/bottle-classifier/releaseIdentity";
import type { Bottle, BottleGroup } from "@peated/server/db/schema";
import { toTitleCase } from "@peated/server/lib/strings";

type StableConcreteBottleIdentity = Pick<
  BottleGroup,
  "name" | "fullName" | "statedAge"
>;

type MaterializedConcreteBottleIdentity = Pick<
  Bottle,
  "name" | "fullName" | "statedAge"
>;

export type ConcreteBottleExactIdentity = Pick<
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

export type ConcreteBottleExactIdentityPatch =
  Partial<ConcreteBottleExactIdentity>;

export type ConcreteBottleGroupMaterialization = Pick<
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

export type MaterializedConcreteBottleForGroup = Pick<
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
export function getConcreteBottleExactStatedAge({
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
export function getConcreteBottleExactIdentity({
  bottle,
  sourceGroupStatedAge,
  exactPatch,
}: {
  bottle: ConcreteBottleExactIdentity;
  sourceGroupStatedAge: number | null;
  exactPatch?: ConcreteBottleExactIdentityPatch;
}): ConcreteBottleExactIdentity {
  return {
    edition: valueOrCurrent(exactPatch?.edition, bottle.edition),
    statedAge: getConcreteBottleExactStatedAge({
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

function formatConcreteCaskIdentity({
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
export function materializeConcreteBottleIdentity({
  stable,
  exact,
}: {
  stable: StableConcreteBottleIdentity;
  exact: ConcreteBottleExactIdentity;
}): MaterializedConcreteBottleIdentity {
  const exactStatedAge = getConcreteBottleExactStatedAge({
    bottleStatedAge: exact.statedAge,
    stableStatedAge: stable.statedAge,
  });
  const identity = formatConcreteCaskIdentity({
    ...formatCanonicalReleaseName({
      bottleName: stable.name,
      bottleFullName: stable.fullName,
      bottleReleaseTraits: {
        caskStrength: exact.caskStrength,
        singleCask: exact.singleCask,
      },
      bottleStatedAge: stable.statedAge,
      release: {
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
export function materializeConcreteBottleForGroup({
  group,
  exact,
}: {
  group: ConcreteBottleGroupMaterialization;
  exact: ConcreteBottleExactIdentity;
}): MaterializedConcreteBottleForGroup {
  return {
    ...materializeConcreteBottleIdentity({ stable: group, exact }),
    brandId: group.brandId,
    bottlerId: group.bottlerId,
    seriesId: group.seriesId,
    category: group.category,
    flavorProfile: group.flavorProfile,
  };
}
