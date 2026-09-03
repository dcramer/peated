import { loadSitemapCountries } from "@peated/web/lib/locationSitemaps";
import { createAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { buildSitemapIndex } from "@peated/web/lib/sitemaps";

export const dynamic = "force-dynamic";

export async function GET() {
  const { client } = await createAnonymousServerClient();
  const countries = await loadSitemapCountries(client.countries.list);
  const xml = await buildSitemapIndex(
    countries.map(
      ({ slug }) => `/sitemaps/regions/${encodeURIComponent(slug)}/sitemap.xml`,
    ),
  );
  return new Response(xml, {
    headers: {
      "Cache-Control":
        "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
      "Content-Type": "application/xml",
    },
  });
}
