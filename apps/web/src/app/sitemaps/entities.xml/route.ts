import { buildPagesSitemap, type Sitemap } from "@peated/web/lib/sitemaps";
import { getTrpcClient } from "@peated/web/lib/trpc.server";

export const revalidate = 86400;

export async function GET() {
  const trpcClient = await getTrpcClient();

  let cursor: number | null = 1;
  const pages: Sitemap = [];
  while (cursor) {
    const { results, rel } = await trpcClient.entityList.fetch(
      {
        cursor,
      },
      {
        gcTime: 0,
      },
    );

    pages.push(
      ...results.map((entity) => ({
        url: `/entities/${entity.id}`,
        lastModified: entity.createdAt, // not correct
      })),
    );

    cursor = rel?.nextCursor || null;
  }

  const pagesSitemapXML = await buildPagesSitemap(pages);

  return new Response(pagesSitemapXML, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
