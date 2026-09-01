import { createAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { buildPagesSitemap, type Sitemap } from "@peated/web/lib/sitemaps";
import { getBottleSeriesUrl } from "@peated/web/lib/urls";

const SITEMAP_CACHE_CONTROL =
  "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";
const API_PAGE_LIMIT = 100;
const API_PAGES_PER_SITEMAP = 10;

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  const sitemapPage = Number(id);
  const { client } = await createAnonymousServerClient();
  const pages: Sitemap = [];
  let cursor = (sitemapPage - 1) * API_PAGES_PER_SITEMAP + 1;

  for (let index = 0; index < API_PAGES_PER_SITEMAP; index += 1) {
    const result = await client.bottleSeries.list({
      cursor,
      limit: API_PAGE_LIMIT,
    });
    pages.push(
      ...result.results.map((series) => ({
        url: getBottleSeriesUrl(series),
        lastModified: series.updatedAt,
      })),
    );
    if (!result.rel.nextCursor) break;
    cursor = result.rel.nextCursor;
  }

  const pagesSitemapXML = await buildPagesSitemap(pages);
  return new Response(pagesSitemapXML, {
    headers: {
      "Cache-Control": SITEMAP_CACHE_CONTROL,
      "Content-Type": "application/xml",
    },
  });
}
