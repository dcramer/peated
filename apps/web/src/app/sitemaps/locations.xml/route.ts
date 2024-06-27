import { buildPagesSitemap, type Sitemap } from "@peated/web/lib/sitemaps";
import { getTrpcClient } from "@peated/web/lib/trpc.server";

export const dynamic = "force-static";

export async function GET() {
  const trpcClient = await getTrpcClient();

  let cursor: number | null = 1;
  const pages: Sitemap = [];
  while (cursor) {
    const { results, rel } = await trpcClient.countryList.fetch(
      {
        cursor,
      },
      {
        gcTime: 0,
      },
    );

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
      "Content-Type": "application/xml",
    },
  });
}
