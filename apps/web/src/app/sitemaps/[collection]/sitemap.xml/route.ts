import {
  getEntitySitemapCollection,
  getEntitySitemapPagePaths,
} from "@peated/web/lib/entitySitemaps";
import { createAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { buildSitemapIndex } from "@peated/web/lib/sitemaps";

const SITEMAP_CACHE_CONTROL =
  "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  props: { params: Promise<{ collection: string }> },
) {
  const { collection } = await props.params;
  const sitemapCollection = getEntitySitemapCollection(collection);
  if (!sitemapCollection) {
    return new Response(null, { status: 404 });
  }

  const { client } = await createAnonymousServerClient();
  const stats = await client.stats();
  const sitemapIndexXML = await buildSitemapIndex(
    getEntitySitemapPagePaths(collection, stats[sitemapCollection.statsKey]),
  );

  return new Response(sitemapIndexXML, {
    headers: {
      "Cache-Control": SITEMAP_CACHE_CONTROL,
      "Content-Type": "application/xml",
    },
  });
}
