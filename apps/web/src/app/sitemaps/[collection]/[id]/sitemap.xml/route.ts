import {
  getEntitySitemapCollection,
  loadEntitySitemapPage,
  type ListSitemapEntities,
} from "@peated/web/lib/entitySitemaps";
import { createAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { buildPagesSitemap } from "@peated/web/lib/sitemaps";

const SITEMAP_CACHE_CONTROL =
  "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  props: { params: Promise<{ collection: string; id: string }> },
) {
  const { collection, id } = await props.params;
  const sitemapCollection = getEntitySitemapCollection(collection);
  if (!sitemapCollection) {
    return new Response(null, { status: 404 });
  }

  const page = Number(id);
  if (!Number.isInteger(page) || page < 1) {
    return new Response(null, { status: 404 });
  }

  const { client } = await createAnonymousServerClient();
  const listEntities: ListSitemapEntities = (input) =>
    client[sitemapCollection.clientKey].list(input);
  const { pages, startCursor } = await loadEntitySitemapPage(
    page,
    listEntities,
  );
  const pagesSitemapXML = await buildPagesSitemap(pages);

  return new Response(pagesSitemapXML, {
    headers: {
      "Cache-Control": SITEMAP_CACHE_CONTROL,
      "X-Cursor-Start": `${startCursor}`,
      "Content-Type": "application/xml",
    },
  });
}
