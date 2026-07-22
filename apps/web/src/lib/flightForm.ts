import type { CatalogTargetV1 } from "@peated/server/schemas";

export type FlightTargetOption = {
  id: number;
  kind: CatalogTargetV1["kind"];
  name: string;
};

export function getFlightTargetIds(targets: CatalogTargetV1[]): number[] {
  return targets.map((target) => target.targetId);
}

export function targetToFlightOption(
  target: CatalogTargetV1,
): FlightTargetOption {
  return {
    id: target.targetId,
    kind: target.kind,
    name:
      target.kind === "bottle" ? target.bottle.fullName : target.group.fullName,
  };
}

export function getFlightTargetScopeLabel(
  kind: FlightTargetOption["kind"],
): string {
  return kind === "bottle" ? "Exact bottle" : "Exact bottle not specified";
}

export function flightMembershipChanged(
  initialTargetIds: number[],
  selectedTargetIds: number[],
): boolean {
  const initial = [...initialTargetIds].sort((left, right) => left - right);
  const selected = [...selectedTargetIds].sort((left, right) => left - right);
  return (
    initial.length !== selected.length ||
    initial.some((targetId, index) => targetId !== selected[index])
  );
}
