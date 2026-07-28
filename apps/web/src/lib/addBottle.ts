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

type AddBottleRouteOptions = {
  bottleId?: number | string | null;
  flightId?: string | null;
  pendingImageId?: string | null;
  pendingImageUrl?: string | null;
  intent?: AddBottleRouteIntent;
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
  flightId,
  pendingImageId,
  pendingImageUrl,
  intent = "addBottle",
}: AddBottleRouteOptions) {
  const params = new URLSearchParams();

  if (bottleId) params.set("bottle", String(bottleId));
  if (flightId) params.set("flight", flightId);
  if (pendingImageId) params.set("pendingImageId", pendingImageId);
  if (pendingImageUrl) params.set("pendingImageUrl", pendingImageUrl);
  params.set("intent", intent);

  return `/addBottle?${params.toString()}`;
}

export function getAddAnotherReleasePath(bottleId: number | string) {
  return `/bottles/${bottleId}/addRelease`;
}
