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

type AddBottleRouteIdentity =
  | {
      bottleId?: never;
      releaseId?: never;
      groupId?: never;
    }
  | {
      bottleId: number | string;
      releaseId?: number | string | null;
      groupId?: never;
    }
  | {
      bottleId?: never;
      releaseId?: never;
      groupId: number | string;
    };

type AddBottleRouteOptions = {
  flightId?: string | null;
  pendingImageId?: string | null;
  pendingImageUrl?: string | null;
  intent?: AddBottleRouteIntent;
} & AddBottleRouteIdentity;

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
  groupId,
  flightId,
  pendingImageId,
  pendingImageUrl,
  intent = "addBottle",
}: AddBottleRouteOptions) {
  if (groupId != null && (bottleId != null || releaseId != null)) {
    throw new Error(
      "Add Bottle links cannot select both exact and generic catalog identity.",
    );
  }
  if (releaseId != null && bottleId == null) {
    throw new Error("Add Bottle release links require a Bottle identity.");
  }

  const params = new URLSearchParams();

  if (bottleId) params.set("bottle", String(bottleId));
  if (releaseId) params.set("release", String(releaseId));
  if (groupId) params.set("group", String(groupId));
  if (flightId) params.set("flight", flightId);
  if (pendingImageId) params.set("pendingImageId", pendingImageId);
  if (pendingImageUrl) params.set("pendingImageUrl", pendingImageUrl);
  params.set("intent", intent);

  return `/addBottle?${params.toString()}`;
}

export function getAddAnotherReleasePath(bottleId: number | string) {
  return `/bottles/${bottleId}/addRelease`;
}
