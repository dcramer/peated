import { buildSitemapIndex } from "@peated/web/lib/sitemaps";

export const dynamic = "force-static";

export async function GET() {
  const sitemapIndexXML = await buildSitemapIndex([
    "/sitemaps/locations.xml",
    "/sitemaps/static.xml",
  ]);

  return new Response(sitemapIndexXML, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
