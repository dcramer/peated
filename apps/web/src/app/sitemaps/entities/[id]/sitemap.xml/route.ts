import { createServerClient } from "@peated/web/lib/orpc/client.server";
import { buildPagesSitemap, type Sitemap } from "@peated/web/lib/sitemaps";

export const dynamic = "force-dynamic";

export const revalidate = 86400;

const PAGE_LIMIT = 1000;

export async function GET(
  request: Request,
  { params: { id } }: { params: { id: string } },
) {
  const { client } = await createServerClient();

  let cursor: number | null = (Number(id) - 1) * (PAGE_LIMIT / 100) + 1;
  let count = 0;
  const pages: Sitemap = [];
  while (cursor && count < PAGE_LIMIT) {
    const { results, rel } = await client.entities.list({
      cursor,
      limit: 100,
      sort: "created",
    });

    pages.push(
      ...results.map((entity) => ({
        url: `/entities/${entity.id}`,
        lastModified: entity.updatedAt,
      })),
    );

    cursor = rel.nextCursor;
    count += results.length;
  }

  const pagesSitemapXML = await buildPagesSitemap(pages);

  return new Response(pagesSitemapXML, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
