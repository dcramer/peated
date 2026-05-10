import type { BottleObservation } from "./classifierTypes";

export function normalizeObservation(
  observation: BottleObservation | null | undefined,
): BottleObservation | null {
  if (!observation) {
    return null;
  }

  const normalized: BottleObservation = {
    selector: observation.selector?.trim() || null,
    caskNumber: observation.caskNumber?.trim() || null,
    barrelNumber: observation.barrelNumber?.trim() || null,
    bottleNumber: observation.bottleNumber?.trim() || null,
    outturn: observation.outturn ?? null,
    market: observation.market?.trim() || null,
    exclusive: observation.exclusive?.trim() || null,
  };

  return Object.values(normalized).some((value) => value !== null)
    ? normalized
    : null;
}
