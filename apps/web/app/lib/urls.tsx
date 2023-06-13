import type { Entity } from "~/types";

export function getEntityUrl(entity: Entity) {
  return `/entities/${entity.id}`;
}
