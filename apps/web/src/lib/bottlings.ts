import type { BottleRelease } from "@peated/server/types";

type BottlingSummary = Pick<
  BottleRelease,
  "edition" | "releaseYear" | "vintageYear" | "fullName"
>;

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

export function formatBottlingCountLabel(numReleases: number) {
  return `${numReleases} bottling${numReleases === 1 ? "" : "s"}`;
}
