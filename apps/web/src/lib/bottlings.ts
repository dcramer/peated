import type { BottleRelease } from "@peated/server/types";

type BottlingSummary = Pick<
  BottleRelease,
  "edition" | "releaseYear" | "vintageYear" | "fullName"
>;

type BottleSummary = {
  fullName: string;
};

const CANONICAL_TRAIT_SUFFIX = /(?: - (?:Single Cask|Cask Strength))+$/;

export function getBottleBottlingsPath(bottleId: number | string) {
  return `/bottles/${bottleId}/bottlings`;
}

export function getBottleBottlingPath(
  bottleId: number | string,
  bottlingId: number | string,
) {
  return `${getBottleBottlingsPath(bottleId)}/${bottlingId}`;
}

export function getBottleBottlingEditPath(
  bottleId: number | string,
  bottlingId: number | string,
) {
  return `${getBottleBottlingPath(bottleId, bottlingId)}/edit`;
}

export function getNewBottleBottlingPath(bottleId: number | string) {
  return `${getBottleBottlingsPath(bottleId)}/new`;
}

export function formatBottlingName(
  bottling: BottlingSummary | null | undefined,
) {
  if (!bottling) return null;

  if (bottling.edition) {
    return `${bottling.edition}${bottling.releaseYear ? ` (${bottling.releaseYear})` : ""}${bottling.vintageYear ? ` (${bottling.vintageYear} Vintage)` : ""}`;
  }

  if (bottling.releaseYear) {
    return `${bottling.releaseYear} Bottling`;
  }

  if (bottling.vintageYear) {
    return `${bottling.vintageYear} Vintage`;
  }

  return bottling.fullName;
}

/** Builds a list-friendly full name without canonical classification suffixes. */
export function formatBottleBottlingName(
  bottle: BottleSummary,
  bottling: BottlingSummary,
) {
  const bottlingName = formatBottlingName(bottling);

  return bottlingName === bottling.fullName
    ? bottling.fullName.replace(CANONICAL_TRAIT_SUFFIX, "")
    : `${bottle.fullName} - ${bottlingName}`;
}

export function formatBottlingCountLabel(numReleases: number) {
  return `${numReleases} bottling${numReleases === 1 ? "" : "s"}`;
}
