import type { Entity } from "@peated/server/types";

export function getEntityUrl(entity: Entity) {
  return `/entities/${entity.id}`;
}

export function buildQueryString(
  search: string,
  newParams: Record<string, any>,
): string {
  const qs = new URLSearchParams(search);
  for (const [key, value] of Object.entries(newParams)) {
    if (value === undefined || value === null) qs.delete(key);
    else qs.set(key, value);
  }
  return qs.toString();
}

export function parseDomain(url: string) {
  const domain = url.split("://", 2)[1].split("/", 2)[0];
  if (domain.indexOf("www.") === 0) return domain.substring(4);
  return domain;
}
