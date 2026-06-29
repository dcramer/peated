import { buildSitemapIndex } from "@peated/web/lib/sitemaps";

const SITEMAP_CACHE_CONTROL =
  "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";

export const dynamic = "force-static";

/**
 * Serves the root sitemap index with the same public CDN policy as child maps.
 */
export async function GET() {
  const sitemapIndexXML = await buildSitemapIndex([
    "/sitemaps/locations.xml",
    "/sitemaps/entities/sitemap.xml",
    "/sitemaps/bottles/sitemap.xml",
    "/sitemaps/static.xml",
  ]);

  return new Response(sitemapIndexXML, {
    headers: {
      "Cache-Control": SITEMAP_CACHE_CONTROL,
      "Content-Type": "application/xml",
    },
  });
}
