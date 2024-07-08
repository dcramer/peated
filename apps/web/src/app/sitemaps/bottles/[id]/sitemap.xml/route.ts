import { buildPagesSitemap, type Sitemap } from "@peated/web/lib/sitemaps";
import { getTrpcClient } from "@peated/web/lib/trpc.server";

export const revalidate = 86400;

const PAGE_LIMIT = 1000;

export async function GET(
  request: Request,
  { params: { id } }: { params: { id: string } },
) {
  const trpcClient = await getTrpcClient();

  let cursor = Number(id) * PAGE_LIMIT;
  let count = 0;
  const pages: Sitemap = [];
  while (cursor) {
    const { results, rel } = await trpcClient.bottleList.fetch(
      {
        cursor,
        limit: 100,
        sort: "created",
      },
      {
        gcTime: 0,
      },
    );

    pages.push(
      ...results.map((bottle) => ({
        url: `/bottles/${bottle.id}`,
        lastModified: bottle.updatedAt, // not correct
      })),
    );

    if (!rel?.nextCursor) break;

    cursor = rel.nextCursor;
    count += results.length;

    if (count >= PAGE_LIMIT) {
      break;
    }
  }

  const pagesSitemapXML = await buildPagesSitemap(pages);

  return new Response(pagesSitemapXML, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
