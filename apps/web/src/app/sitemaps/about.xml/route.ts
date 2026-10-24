import { createAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { buildPagesSitemap, type Sitemap } from "@peated/web/lib/sitemaps";
import { getEntityUrl } from "@peated/web/lib/urls";

const SITEMAP_CACHE_CONTROL =
  "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";

export const dynamic = "force-dynamic";

/**
 * Entity About pages. The server lists only pages the About tab shows, so this
 * map never links a page that returns not found.
 */
export async function GET() {
  const { client } = await createAnonymousServerClient();
  const pages: Sitemap = [];
  let afterId: number | null = 0;
  while (afterId !== null) {
    const { results, nextAfterId } = await client.entities.about.sitemap({
      afterId,
    });
    for (const entity of results) {
      pages.push({
        url: `${getEntityUrl(entity)}/about`,
        lastModified: entity.updatedAt,
      });
    }
    afterId = nextAfterId;
  }

  return new Response(await buildPagesSitemap(pages), {
    headers: {
      "Cache-Control": SITEMAP_CACHE_CONTROL,
      "Content-Type": "application/xml",
    },
  });
}
