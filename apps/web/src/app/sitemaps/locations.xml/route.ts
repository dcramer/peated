import { createServerClient } from "@peated/web/lib/orpc/client.server";
import { buildPagesSitemap, type Sitemap } from "@peated/web/lib/sitemaps";

export const dynamic = "force-dynamic";

export const revalidate = 86400;

export async function GET() {
  const client = await createServerClient();

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
      "Content-Type": "application/xml",
    },
  });
}
