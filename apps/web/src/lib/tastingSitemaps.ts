import type { Sitemap } from "./sitemaps";
import { getTastingUrl } from "./urls";

const PAGE_LIMIT = 1000;
const API_PAGE_LIMIT = 100;

export function getTastingSitemapPagePaths(total: number): string[] {
  // Tasting stats include private records; use the total only as an upper bound.
  return Array.from(
    { length: Math.ceil(total / PAGE_LIMIT) },
    (_, index) => `/sitemaps/tastings/${index + 1}/sitemap.xml`,
  );
}

export async function loadTastingSitemapPage(
  page: number,
  listTastings: (input: { cursor: number; limit: number }) => Promise<{
    results: (Parameters<typeof getTastingUrl>[0] & {
      createdBy: { private: boolean };
    })[];
    rel: { nextCursor: number | null };
  }>,
): Promise<Sitemap> {
  const pagesPerSitemap = PAGE_LIMIT / API_PAGE_LIMIT;
  const startCursor = (page - 1) * pagesPerSitemap + 1;
  let cursor: number | null = startCursor;
  const pages: Sitemap = [];

  for (let i = 0; cursor && i < pagesPerSitemap; i++) {
    const { results, rel } = await listTastings({
      cursor,
      limit: API_PAGE_LIMIT,
    });
    pages.push(
      ...results
        .filter((tasting) => !tasting.createdBy.private)
        .map((tasting) => ({ url: getTastingUrl(tasting) })),
    );
    cursor = rel.nextCursor;
  }

  return pages;
}
