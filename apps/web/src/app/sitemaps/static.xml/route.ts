import { buildPagesSitemap } from "@peated/web/lib/sitemaps";

const SITEMAP_CACHE_CONTROL =
  "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";

export const revalidate = 86400;

export async function GET() {
  const pagesSitemapXML = await buildPagesSitemap([
    { url: "/about" },
    { url: "/entities/4263/codes" },
  ]);

  return new Response(pagesSitemapXML, {
    headers: {
      "Cache-Control": SITEMAP_CACHE_CONTROL,
      "Content-Type": "application/xml",
    },
  });
}
