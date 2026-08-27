import { createAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
import { buildPagesSitemap } from "@peated/web/lib/sitemaps";
import { getEntityUrl } from "@peated/web/lib/urls";

const SITEMAP_CACHE_CONTROL =
  "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";

export const revalidate = 86400;

export async function GET() {
  const { client } = await createAnonymousServerClient();
  const smws = await resolveOrNotFound(
    client.entities.details({ entity: 4263 }),
  );
  const pagesSitemapXML = await buildPagesSitemap([
    { url: "/about" },
    { url: `${getEntityUrl(smws)}/codes` },
  ]);

  return new Response(pagesSitemapXML, {
    headers: {
      "Cache-Control": SITEMAP_CACHE_CONTROL,
      "Content-Type": "application/xml",
    },
  });
}
