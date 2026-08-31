import type { Entity } from "@peated/server/types";

type FollowingEntity = Pick<Entity, "id" | "isFollowing">;

/** Applies local follow overrides to both rows and total until the server list refreshes. */
export function filterFollowingEntities<T extends FollowingEntity>(
  list: { results: readonly T[]; total: number },
  isFollowing: (entity: T) => boolean,
) {
  const results = list.results.filter(isFollowing);
  const hiddenCount = list.results.length - results.length;

  return { results, total: list.total - hiddenCount };
}
