import { ENTITY_SITEMAP_COLLECTIONS } from "@peated/web/lib/entitySitemaps";
import { buildSitemapIndex } from "@peated/web/lib/sitemaps";

const SITEMAP_CACHE_CONTROL =
  "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";

export const dynamic = "force-static";

/**
 * List preferred catalog pages. Public tastings and member reviews rely on
 * normal links instead. See docs/features/catalog-page-seo.md. Child maps use
 * the same public CDN cache rules as this index.
 */
export async function GET() {
  const sitemapIndexXML = await buildSitemapIndex([
    "/sitemaps/locations.xml",
    "/sitemaps/regions/sitemap.xml",
    ...ENTITY_SITEMAP_COLLECTIONS.map(
      ({ collection }) => `/sitemaps/${collection}/sitemap.xml`,
    ),
    "/sitemaps/bottles/sitemap.xml",
    "/sitemaps/series/sitemap.xml",
    "/sitemaps/static.xml",
  ]);

  return new Response(sitemapIndexXML, {
    headers: {
      "Cache-Control": SITEMAP_CACHE_CONTROL,
      "Content-Type": "application/xml",
    },
  });
}
