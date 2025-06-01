import type { Entity, EntityType } from "@peated/server/types";

export function getEntityUrl(entity: Entity) {
  return `/entities/${entity.id}`;
}

export function getEntityTypeSearchUrl(type: EntityType) {
  let link: string;
  switch (type) {
    case "bottler":
      link = "/bottlers";
      break;
    case "brand":
      link = "/brands";
      break;
    case "distiller":
      link = "/distillers";
      break;
  }
  return link;
}

/**
 * @deprecated Use TanStack Router's built-in search prop with functions instead:
 * `search={(prev) => ({ ...prev, newParam: value })}`
 * See: https://tanstack.com/router/v1/docs/framework/react/guide/search-params
 */
export function buildQueryString(
  searchParams: URLSearchParams,
  newParams: Record<string, any>
): string {
  const newEntries = Array.from(Object.entries(newParams)).filter(([k, v]) => {
    return k && v !== undefined && v !== null;
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
