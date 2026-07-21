import type { CatalogTargetV1 } from "@peated/server/schemas";

export function getFlightExactBottleIds(targets: CatalogTargetV1[]): number[] {
  return targets.flatMap((target) =>
    target.kind === "bottle" ? [target.bottle.id] : [],
  );
}

export function canEditFlightMembership(targets: CatalogTargetV1[]): boolean {
  return targets.every((target) => target.kind === "bottle");
}

export function flightMembershipChanged(
  initialBottleIds: number[],
  selectedBottleIds: number[],
): boolean {
  const initial = [...initialBottleIds].sort((left, right) => left - right);
  const selected = [...selectedBottleIds].sort((left, right) => left - right);
  return (
    initial.length !== selected.length ||
    initial.some((bottleId, index) => bottleId !== selected[index])
  );
}
