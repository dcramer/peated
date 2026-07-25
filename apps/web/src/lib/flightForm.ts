import type { Bottle } from "@peated/server/types";

export type FlightBottleOption = {
  id: number;
  name: string;
};

export function getFlightBottleIds(bottles: Bottle[]): number[] {
  return bottles.map((bottle) => bottle.id);
}

export function bottleToFlightOption(bottle: Bottle): FlightBottleOption {
  return {
    id: bottle.id,
    name: bottle.fullName,
  };
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
