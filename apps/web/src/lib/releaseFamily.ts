import { notFound } from "next/navigation";

type ReleaseFamilyGroup = {
  id: number;
  representativeBottleId: number | null;
};

export function parseReleaseFamilyRouteId(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) {
    notFound();
  }

  const bottleId = Number(value);
  if (!Number.isSafeInteger(bottleId)) {
    notFound();
  }
  return bottleId;
}

export function requireReleaseFamilyGroup<
  Group extends ReleaseFamilyGroup,
>(value: { group?: Group }): Group {
  if (!value.group) {
    throw new Error(
      "Bottle details are missing their required release family.",
    );
  }
  return value.group;
}

/** Returns the active member used only to locate a release-family web route. */
export function requireReleaseFamilyAnchor(group: ReleaseFamilyGroup): number {
  const anchorBottleId = group.representativeBottleId;
  if (
    anchorBottleId === null ||
    !Number.isSafeInteger(anchorBottleId) ||
    anchorBottleId < 1
  ) {
    throw new Error(
      `Active release family ${group.id} has no valid representative Bottle.`,
    );
  }
  return anchorBottleId;
}

export function getReleaseFamilyHref(
  anchorBottleId: number,
  search = "",
): string {
  if (!Number.isSafeInteger(anchorBottleId) || anchorBottleId < 1) {
    throw new Error("A valid Bottle anchor is required for a release family.");
  }
  return `/bottles/${anchorBottleId}/releases${search}`;
}
