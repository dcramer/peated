export type AddBottleRouteIntent =
  | "catalog"
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
  resultSource?: "created";
  intent?: AddBottleRouteIntent;
  wrongPhotoMatchId?: number | null;
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

/** Reads the wrong photo match that the next chosen Bottle completes. */
export function getWrongPhotoMatchFromParams(
  searchParams: Pick<URLSearchParams, "get">,
) {
  const id = Number(searchParams.get("wrongPhotoMatch"));
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function getAddBottleHref({
  bottleId,
  flightId,
  pendingImageId,
  pendingImageUrl,
  resultSource,
  intent = "choose",
  wrongPhotoMatchId,
}: AddBottleRouteOptions) {
  const params = new URLSearchParams();

  if (bottleId) params.set("bottle", String(bottleId));
  if (flightId) params.set("flight", flightId);
  if (pendingImageId) params.set("pendingImageId", pendingImageId);
  if (pendingImageUrl) params.set("pendingImageUrl", pendingImageUrl);
  if (resultSource) params.set("resultSource", resultSource);
  if (wrongPhotoMatchId) {
    params.set("wrongPhotoMatch", String(wrongPhotoMatchId));
  }
  params.set("intent", intent);

  return `/addBottle?${params.toString()}`;
}

export function getAddSimilarBottlePath(bottleId: number | string) {
  return `/bottles/${bottleId}/addRelease`;
}
