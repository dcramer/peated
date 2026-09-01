import type { EntityKind } from "@peated/server/types";

const ENTITY_COLLECTION_BY_KIND = {
  brand: "/brands",
  distillery: "/distillers",
  bottler: "/bottlers",
  company: "/companies",
} as const satisfies Record<EntityKind, `/${string}`>;

export function getBottleUrl(
  bottle: Pick<{ id: number }, "id">,
): `/bottles/${number}` {
  return `/bottles/${bottle.id}`;
}

export function getEntityUrl(entity: {
  id: number;
  kind: EntityKind | null;
}): `/${string}` {
  if (!entity.kind) return `/entities/${entity.id}`;
  return `${ENTITY_COLLECTION_BY_KIND[entity.kind]}/${entity.id}`;
}

export function getEntityKindSearchUrl(kind: EntityKind) {
  let link: string;
  switch (kind) {
    case "bottler":
      link = "/bottlers";
      break;
    case "brand":
      link = "/brands";
      break;
    case "distillery":
      link = "/distillers";
      break;
    case "company":
      link = "/companies";
      break;
  }
  return link;
}

export function buildQueryString(
  searchParams: URLSearchParams,
  newParams: Record<string, boolean | null | number | string | undefined>,
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
