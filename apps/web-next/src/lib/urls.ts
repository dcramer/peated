import type { Entity } from "@peated/server/types";

export function getEntityUrl(entity: Entity) {
  return `/entities/${entity.id}`;
}

export function buildQueryString(
  searchParams: URLSearchParams,
  newParams: Record<string, any>,
): string {
  const newEntries = Array.from(Object.entries(newParams)).filter(([k, v]) => {
    return !k || v === undefined || v === null;
  });
  Array.from(searchParams.entries()).forEach(([k, v]) => {
    if (!newParams[k]) {
      newEntries.push([k, v]);
    }
  });
  return new URLSearchParams(newEntries).toString();
}

export function parseDomain(url: string) {
  const domain = url.split("://", 2)[1].split("/", 2)[0];
  if (domain.startsWith("www.")) return domain.substring(4);
  return domain;
}
