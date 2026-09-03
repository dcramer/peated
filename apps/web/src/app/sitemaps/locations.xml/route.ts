import {
  getCountrySitemapPages,
  loadSitemapCountries,
} from "@peated/web/lib/locationSitemaps";
import { createAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { buildPagesSitemap } from "@peated/web/lib/sitemaps";

const SITEMAP_CACHE_CONTROL =
  "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800";

export const dynamic = "force-dynamic";

export async function GET() {
  const { client } = await createAnonymousServerClient();

  const countries = await loadSitemapCountries(client.countries.list);
  const pages = getCountrySitemapPages(countries);

  const pagesSitemapXML = await buildPagesSitemap(pages);

  return new Response(pagesSitemapXML, {
    headers: {
      "Cache-Control": SITEMAP_CACHE_CONTROL,
      "Content-Type": "application/xml",
    },
  });
}
