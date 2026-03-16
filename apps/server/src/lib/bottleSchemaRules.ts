import type { Bottle, BottleRelease } from "@peated/server/db/schema";

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
    "Bottle identity is the stable parent product. Brand, bottler, distillery, expression/name, series, and category belong here.",
  releaseIdentity:
    "Release identity is optional and only exists under a bottle. Edition, ABV, years, single-cask, cask-strength, and cask details belong here.",
  aliasPolicy:
    "Retailer listing aliases are bottle-level evidence unless they exactly match a canonical release alias.",
} as const;

export const DEFAULT_PRICE_MATCH_CREATION_TARGET = "bottle" as const;

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
  bottle: Pick<Bottle, "statedAge">;
  release: ReleaseIdentityInput;
}): ReleaseIdentityInput {
  return {
    edition: release.edition ?? null,
    statedAge: bottle.statedAge ?? release.statedAge ?? null,
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
  const resolvedRelease = getResolvedReleaseIdentity({
    bottle: {
      statedAge: bottleStatedAge,
    },
    release,
  });

  const nameBits = [bottleName];
  const fullNameBits = [bottleFullName];

  for (const field of RELEASE_IDENTITY_FIELDS) {
    if (field === "statedAge" && bottleStatedAge !== null) {
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
