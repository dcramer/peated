import { loadRegionSitemap } from "@peated/web/lib/locationSitemaps";
import { createAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
import { buildPagesSitemap } from "@peated/web/lib/sitemaps";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  props: { params: Promise<{ countrySlug: string }> },
) {
  const { countrySlug } = await props.params;
  const { client } = await createAnonymousServerClient();
  const country = await resolveOrNotFound(
    client.countries.details({ country: countrySlug }),
  );
  const pages = await loadRegionSitemap(country.slug, client.regions.list);
  return new Response(await buildPagesSitemap(pages), {
    headers: {
      "Cache-Control":
        "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
      "Content-Type": "application/xml",
    },
  });
}
