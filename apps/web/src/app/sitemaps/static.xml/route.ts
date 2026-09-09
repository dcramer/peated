import { buildPagesSitemap } from "@peated/web/lib/sitemaps";

const SITEMAP_CACHE_CONTROL =
  "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";

export const revalidate = 86400;

export async function GET() {
  // Add a static page only when it should appear in search.
  // See docs/features/catalog-page-seo.md.
  const pagesSitemapXML = await buildPagesSitemap([
    { url: "/" },
    { url: "/bottles" },
    { url: "/brands" },
    { url: "/distillers" },
    { url: "/bottlers" },
    { url: "/companies" },
    { url: "/about" },
    { url: "/about/api" },
    { url: "/about/catalog" },
    { url: "/about/categories" },
    { url: "/about/ratings" },
    { url: "/about/tasting-wheel" },
    { url: "/bot" },
    { url: "/bottlers/4263-scotch-malt-whisky-society/codes" },
    { url: "/activity" },
    { url: "/events" },
    { url: "/updates" },
  ]);

  return new Response(pagesSitemapXML, {
    headers: {
      "Cache-Control": SITEMAP_CACHE_CONTROL,
      "Content-Type": "application/xml",
    },
  });
}
