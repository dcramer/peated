export type AddBottleRouteIntent =
  | "addBottle"
  | "choose"
  | "library"
  | "tasting"
  | "view";

export function getAddBottleHref({
  bottleId,
  releaseId,
  flightId,
  intent = "addBottle",
}: {
  bottleId?: number | string | null;
  releaseId?: number | string | null;
  flightId?: string | null;
  intent?: AddBottleRouteIntent;
}) {
  const params = new URLSearchParams();

  if (bottleId) params.set("bottle", String(bottleId));
  if (releaseId) params.set("release", String(releaseId));
  if (flightId) params.set("flight", flightId);
  params.set("intent", intent);

  return `/addBottle?${params.toString()}`;
}
