import { loadBottleSitemapPage } from "@peated/web/lib/bottleSitemaps";
import { createAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { buildPagesSitemap } from "@peated/web/lib/sitemaps";

const SITEMAP_CACHE_CONTROL =
  "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;

  const { client } = await createAnonymousServerClient();
  const pages = await loadBottleSitemapPage(Number(id), client.bottles.sitemap);
  const pagesSitemapXML = await buildPagesSitemap(pages);

  return new Response(pagesSitemapXML, {
    headers: {
      "Cache-Control": SITEMAP_CACHE_CONTROL,
      "Content-Type": "application/xml",
    },
  });
}
