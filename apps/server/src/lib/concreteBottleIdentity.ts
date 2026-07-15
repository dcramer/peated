import {
  formatCanonicalReleaseName,
  type ReleaseIdentityInput,
} from "@peated/bottle-classifier/releaseIdentity";
import { toTitleCase } from "@peated/server/lib/strings";

type StableConcreteBottleIdentity = {
  name: string;
  fullName: string;
  statedAge: number | null;
};

type MaterializedConcreteBottleIdentity = {
  name: string;
  fullName: string;
  statedAge: number | null;
};

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
  exact: ReleaseIdentityInput;
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
