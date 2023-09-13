import type { Entity } from "@peated/shared/types";

export function getEntityUrl(entity: Entity) {
  return `/entities/${entity.id}`;
}

export function buildQueryString(
  search: string,
  newParams: Record<string, any>,
): string {
  const qs = new URLSearchParams(search);
  for (const [key, value] of Object.entries(newParams)) {
    qs.set(key, value);
  }
  return qs.toString();
}
