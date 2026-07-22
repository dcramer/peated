import type { Entity, Tasting } from "@peated/server/db/schema";
import type { Category } from "@peated/server/types";

export type PersistedBadgeTasting = Pick<
  Tasting,
  "id" | "createdById" | "targetId" | "bottleId" | "releaseId"
>;

export type BadgeIdentityEntity = Pick<Entity, "id" | "countryId" | "regionId">;

type BadgeIdentityBase = {
  statedAge: number | null;
  category: Category | null;
  brand: BadgeIdentityEntity;
  bottler: BadgeIdentityEntity | null;
  distillers: BadgeIdentityEntity[];
};

export type BadgeIdentity =
  | (BadgeIdentityBase & {
      kind: "bottle";
      bottleId: number;
    })
  | (BadgeIdentityBase & { kind: "group" });

export type BadgeTasting = Pick<Tasting, "id" | "createdById"> & {
  identity: BadgeIdentity;
};

export type TrackedObject = {
  type: "bottle" | "entity" | "country" | "region";
  id: number;
};
