import type { Sitemap } from "./sitemaps";
import { getBottleUrl } from "./urls";

const PAGE_LIMIT = 1000;
const API_PAGE_LIMIT = 100;

type SitemapBottle = Parameters<typeof getBottleUrl>[0] & {
  updatedAt: string;
};

export type ListSitemapBottles = (input: {
  cursor: number;
  limit: number;
  sort: "created";
}) => Promise<{ results: SitemapBottle[] }>;

export async function loadBottleSitemapPage(
  page: number,
  listBottles: ListSitemapBottles,
): Promise<{ pages: Sitemap; startCursor: number }> {
  const pagesPerSitemap = PAGE_LIMIT / API_PAGE_LIMIT;
  const startCursor = (page - 1) * pagesPerSitemap + 1;
  const results = await Promise.all(
    Array.from({ length: pagesPerSitemap }, (_, index) =>
      listBottles({
        cursor: startCursor + index,
        limit: API_PAGE_LIMIT,
        sort: "created",
      }),
    ),
  );

  return {
    pages: results.flatMap((result) =>
      result.results.map((bottle) => ({
        url: getBottleUrl(bottle),
        lastModified: bottle.updatedAt,
      })),
    ),
    startCursor,
  };
}
