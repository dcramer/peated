import { createAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { buildSitemapIndex } from "@peated/web/lib/sitemaps";
import { getTastingSitemapPagePaths } from "@peated/web/lib/tastingSitemaps";

export const dynamic = "force-dynamic";

export async function GET() {
  const { client } = await createAnonymousServerClient();
  const { tastings } = await client.stats();
  const xml = await buildSitemapIndex(getTastingSitemapPagePaths(tastings));

  return new Response(xml, {
    headers: {
      "Cache-Control":
        "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
      "Content-Type": "application/xml",
    },
  });
}
