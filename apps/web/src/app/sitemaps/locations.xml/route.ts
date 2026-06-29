import { createAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { buildPagesSitemap, type Sitemap } from "@peated/web/lib/sitemaps";

const SITEMAP_CACHE_CONTROL =
  "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";

export const dynamic = "force-dynamic";

export async function GET() {
  const { client } = await createAnonymousServerClient();

  let cursor: number | null = 1;
  const pages: Sitemap = [{ url: "/locations" }];
  while (cursor) {
    const { results, rel } = await client.countries.list({
      cursor,
    });

    pages.push(
      ...results.map((country) => ({
        url: `/locations/${country.slug}`,
      })),
    );

    cursor = rel?.nextCursor || null;
  }

  const pagesSitemapXML = await buildPagesSitemap(pages);

  return new Response(pagesSitemapXML, {
    headers: {
      "Cache-Control": SITEMAP_CACHE_CONTROL,
      "Content-Type": "application/xml",
    },
  });
}
