import type { BottleDisplayNameSource } from "@peated/server/lib/bottleDisplayName";
import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import type { EntityKind } from "@peated/server/types";
import slugify from "@sindresorhus/slugify";

const ENTITY_COLLECTION_BY_KIND = {
  brand: "/brands",
  distillery: "/distillers",
  bottler: "/bottlers",
  company: "/companies",
} as const satisfies Record<EntityKind, `/${string}`>;

export function getBottleUrl(
  bottle: BottleDisplayNameSource & { id: number },
): `/bottles/${number}-${string}` {
  const slug = createUrlSlug(formatBottleDisplayName(bottle), "bottle");
  return `/bottles/${bottle.id}-${slug}`;
}

export function getEntityUrl(entity: {
  id: number;
  kind: EntityKind | null;
  name: string;
}): `/${string}` {
  const collection = entity.kind
    ? ENTITY_COLLECTION_BY_KIND[entity.kind]
    : "/entities";
  return `${collection}/${entity.id}-${createUrlSlug(entity.name, "entity")}`;
}

function createUrlSlug(value: string, fallback: "bottle" | "entity"): string {
  const asciiSlug = slugify(value);
  if (asciiSlug) return asciiSlug;

  const unicodeSlug = value
    .normalize("NFKC")
    .toLowerCase()
    .match(/[\p{Letter}\p{Mark}\p{Number}]+/gu)
    ?.join("-")
    .normalize("NFC");
  return unicodeSlug || fallback;
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
