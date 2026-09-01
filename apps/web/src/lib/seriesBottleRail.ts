/** Keeps the current Bottle out of a compact Series rail. */
export function selectOtherSeriesBottles<T extends { id: number }>(
  bottles: readonly T[],
  currentBottleId: number,
  limit = 3,
) {
  return bottles
    .filter((bottle) => bottle.id !== currentBottleId)
    .slice(0, limit);
}
