import type { Entity, EntityKind, EntityType } from "@peated/server/types";

const ENTITY_COLLECTION_BY_KIND = {
  brand: "/brands",
  distillery: "/distillers",
  bottler: "/bottlers",
  blender: "/blenders",
  company: "/companies",
} as const satisfies Record<EntityKind, `/${string}`>;

export function getEntityRoutePrefixes(entityId: number): `/${string}`[] {
  return [
    ...Object.values(ENTITY_COLLECTION_BY_KIND).map(
      (collection): `/${string}` => `${collection}/${entityId}`,
    ),
    `/entities/${entityId}`,
  ];
}

export function getBottleUrl(
  bottle: Pick<{ id: number }, "id">,
): `/bottles/${number}` {
  return `/bottles/${bottle.id}`;
}

export function getEntityUrl(
  entity: Pick<Entity, "id"> & Partial<Pick<Entity, "kind">>,
  fallbackKind?: EntityKind,
): `/${string}` {
  // Older records can lack a kind. Keep their existing route until the data
  // owns the invariant that every public Entity has a primary kind.
  const kind = entity.kind === undefined ? fallbackKind : entity.kind;
  const collection = kind ? ENTITY_COLLECTION_BY_KIND[kind] : "/entities";
  return `${collection}/${entity.id}`;
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
