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

export function buildQueryString(
  searchParams: URLSearchParams,
  newParams: Record<string, any>,
): string {
  const nextSearchParams = new URLSearchParams(searchParams.toString());

  for (const [key, value] of Object.entries(newParams)) {
    if (!key) {
      continue;
    }

    if (value === undefined || value === null || value === "") {
      nextSearchParams.delete(key);
      continue;
    }

    nextSearchParams.set(key, String(value));
  }

  return nextSearchParams.toString();
}

export function parseDomain(url: string) {
  const domain = url.split("://", 2)[1].split("/", 2)[0];
  if (domain.startsWith("www.")) return domain.substring(4);
  return domain;
}
