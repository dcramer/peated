export type AddBottleRouteIntent =
  | "addBottle"
  | "choose"
  | "library"
  | "tasting"
  | "view";

export type PendingImageRouteState = {
  id: string;
  imageUrl?: string | null;
};

export function getPendingImageFromParams(
  searchParams: Pick<URLSearchParams, "get">,
) {
  const id = searchParams.get("pendingImageId")?.trim();
  if (!id) return null;

  return {
    id,
    imageUrl: searchParams.get("pendingImageUrl") || "",
  };
}

export function getAddBottleHref({
  bottleId,
  releaseId,
  flightId,
  pendingImageId,
  pendingImageUrl,
  intent = "addBottle",
}: {
  bottleId?: number | string | null;
  releaseId?: number | string | null;
  flightId?: string | null;
  pendingImageId?: string | null;
  pendingImageUrl?: string | null;
  intent?: AddBottleRouteIntent;
}) {
  const params = new URLSearchParams();

  if (bottleId) params.set("bottle", String(bottleId));
  if (releaseId) params.set("release", String(releaseId));
  if (flightId) params.set("flight", flightId);
  if (pendingImageId) params.set("pendingImageId", pendingImageId);
  if (pendingImageUrl) params.set("pendingImageUrl", pendingImageUrl);
  params.set("intent", intent);

  return `/addBottle?${params.toString()}`;
}
