import type { Entity } from "@peated/server/types";
import type { EntityIdentity } from "../components/entityIdentityRow.stylex";

/** Uses only stored identity facts; partial reads leave missing facts absent. */
export function getEntityIdentityProps(
  entity: Pick<Entity, "name"> &
    Partial<Pick<Entity, "kind" | "isFollowing">> & {
      country?: { name: string } | null;
      region?: { name: string } | null;
    },
): EntityIdentity {
  return {
    name: entity.name,
    kind: entity.kind,
    location:
      [entity.region?.name, entity.country?.name].filter(Boolean).join(", ") ||
      undefined,
    isFollowing: entity.isFollowing,
  };
}
