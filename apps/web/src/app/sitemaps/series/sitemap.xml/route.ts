import { createAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { buildSitemapIndex } from "@peated/web/lib/sitemaps";

const SITEMAP_CACHE_CONTROL =
  "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";
const PAGE_LIMIT = 1000;

export const dynamic = "force-dynamic";

export async function GET() {
  const { client } = await createAnonymousServerClient();
  const { total } = await client.bottleSeries.list({ limit: 1 });
  const pageCount = Math.ceil(total / PAGE_LIMIT);
  const sitemapIndexXML = await buildSitemapIndex(
    Array.from(
      { length: pageCount },
      (_, index) => `/sitemaps/series/${index + 1}/sitemap.xml`,
    ),
  );

  return new Response(sitemapIndexXML, {
    headers: {
      "Cache-Control": SITEMAP_CACHE_CONTROL,
      "Content-Type": "application/xml",
    },
  });
}
