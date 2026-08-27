import { createAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { buildPagesSitemap, type Sitemap } from "@peated/web/lib/sitemaps";
import { getEntityUrl } from "@peated/web/lib/urls";

const SITEMAP_CACHE_CONTROL =
  "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";

export const dynamic = "force-dynamic";

const PAGE_LIMIT = 1000;

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;

  const { id } = params;

  const { client } = await createAnonymousServerClient();
  const listKinds = [
    client.brands.list,
    client.distilleries.list,
    client.bottlers.list,
    client.blenders.list,
    client.companies.list,
  ];
  const entities = (
    await Promise.all(
      listKinds.map(async (listKind) => {
        let cursor: number | null = 1;
        const results = [];
        while (cursor) {
          const page = await listKind({ cursor, limit: 100, sort: "created" });
          results.push(...page.results);
          cursor = page.rel.nextCursor;
        }
        return results;
      }),
    )
  )
    .flat()
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const offset = (Number(id) - 1) * PAGE_LIMIT;
  const pages: Sitemap = entities
    .slice(offset, offset + PAGE_LIMIT)
    .map((entity) => ({
      url: getEntityUrl(entity),
      lastModified: entity.updatedAt,
    }));

  const pagesSitemapXML = await buildPagesSitemap(pages);

  return new Response(pagesSitemapXML, {
    headers: {
      "Cache-Control": SITEMAP_CACHE_CONTROL,
      "Content-Type": "application/xml",
    },
  });
}
