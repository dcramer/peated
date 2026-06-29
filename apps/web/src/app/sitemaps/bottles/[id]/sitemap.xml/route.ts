import { createAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { buildPagesSitemap, type Sitemap } from "@peated/web/lib/sitemaps";

const SITEMAP_CACHE_CONTROL =
  "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";

export const dynamic = "force-dynamic";

const PAGE_LIMIT = 1000;

export async function GET(
  request: Request,
  { params: { id } }: { params: { id: string } },
) {
  const { client } = await createAnonymousServerClient();

  const startCursor = (Number(id) - 1) * (PAGE_LIMIT / 100) + 1;

  let cursor: number | null = startCursor;
  let count = 0;
  const pages: Sitemap = [];
  while (cursor && count < PAGE_LIMIT) {
    const { results, rel } = await client.bottles.list({
      cursor,
      limit: 100,
      sort: "created",
    });

    pages.push(
      ...results.map((bottle) => ({
        url: `/bottles/${bottle.id}`,
        lastModified: bottle.updatedAt,
      })),
    );

    cursor = rel.nextCursor;
    count += results.length;
  }

  const pagesSitemapXML = await buildPagesSitemap(pages);

  return new Response(pagesSitemapXML, {
    headers: {
      "Cache-Control": SITEMAP_CACHE_CONTROL,
      "X-Cursor-Start": `${startCursor}`,
      "Content-Type": "application/xml",
    },
  });
}
