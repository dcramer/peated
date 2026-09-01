import type { BottleDisplayNameSource } from "@peated/server/lib/bottleDisplayName";
import { getBottleUrl } from "./urls";

type ReleaseFamilyGroup = {
  id: number;
  representativeBottleId: number | null;
};

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
  anchorBottle: BottleDisplayNameSource & { id: number },
  search = "",
): string {
  if (!Number.isSafeInteger(anchorBottle.id) || anchorBottle.id < 1) {
    throw new Error("A valid Bottle anchor is required for a release family.");
  }
  return `${getBottleUrl(anchorBottle)}/releases${search}`;
}
