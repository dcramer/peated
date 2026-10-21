import type { Bottle } from "@peated/server/types";

export function getFlightBottleIds(
  bottles: Array<Pick<Bottle, "id">>,
): number[] {
  return bottles.map((bottle) => bottle.id);
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
