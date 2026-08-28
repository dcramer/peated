import type { Entity, EntityKind } from "@peated/server/types";
import type { Sitemap } from "./sitemaps";
import { getEntityUrl } from "./urls";

export const ENTITY_SITEMAP_PAGE_LIMIT = 1000;
const API_PAGE_LIMIT = 500;

type EntitySitemapStatsKey =
  | "blenders"
  | "bottlers"
  | "brands"
  | "companies"
  | "distilleries";

export const ENTITY_SITEMAP_COLLECTIONS = [
  {
    clientKey: "brands",
    collection: "brands",
    kind: "brand",
    statsKey: "brands",
  },
  {
    clientKey: "distilleries",
    collection: "distillers",
    kind: "distillery",
    statsKey: "distilleries",
  },
  {
    clientKey: "bottlers",
    collection: "bottlers",
    kind: "bottler",
    statsKey: "bottlers",
  },
  {
    clientKey: "blenders",
    collection: "blenders",
    kind: "blender",
    statsKey: "blenders",
  },
  {
    clientKey: "companies",
    collection: "companies",
    kind: "company",
    statsKey: "companies",
  },
] as const satisfies readonly {
  clientKey: string;
  collection: string;
  kind: EntityKind;
  statsKey: EntitySitemapStatsKey;
}[];

export type EntitySitemapCollection =
  (typeof ENTITY_SITEMAP_COLLECTIONS)[number];

type SitemapEntity = Pick<Entity, "id" | "kind" | "updatedAt">;

export type ListSitemapEntities = (input: {
  cursor: number;
  limit: number;
  sort: "created";
}) => Promise<{
  results: SitemapEntity[];
  rel: { nextCursor: number | null };
}>;

export function getEntitySitemapCollection(
  collection: string,
): EntitySitemapCollection | undefined {
  return ENTITY_SITEMAP_COLLECTIONS.find(
    (candidate) => candidate.collection === collection,
  );
}

export function getEntitySitemapPagePaths(
  collection: string,
  total: number,
): string[] {
  return Array.from(
    { length: Math.ceil(total / ENTITY_SITEMAP_PAGE_LIMIT) },
    (_, index) => `/sitemaps/${collection}/${index + 1}/sitemap.xml`,
  );
}

export async function loadEntitySitemapPage(
  page: number,
  listEntities: ListSitemapEntities,
): Promise<{ pages: Sitemap; startCursor: number }> {
  const pagesPerSitemap = ENTITY_SITEMAP_PAGE_LIMIT / API_PAGE_LIMIT;
  const startCursor = (page - 1) * pagesPerSitemap + 1;
  let cursor: number | null = startCursor;
  const pages: Sitemap = [];

  while (cursor && pages.length < ENTITY_SITEMAP_PAGE_LIMIT) {
    const { results, rel } = await listEntities({
      cursor,
      limit: API_PAGE_LIMIT,
      sort: "created",
    });

    pages.push(
      ...results.map((entity) => ({
        url: getEntityUrl(entity),
        lastModified: entity.updatedAt,
      })),
    );
    cursor = rel.nextCursor;
  }

  return { pages, startCursor };
}
