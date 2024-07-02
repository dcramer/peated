import { buildSitemapIndex } from "@peated/web/lib/sitemaps";

export const dynamic = "force-static";

export async function GET() {
  const sitemapIndexXML = await buildSitemapIndex([
    "/sitemaps/bottles/sitemap.xml",
    "/sitemaps/entities/sitemap.xml",
    "/sitemaps/locations.xml",
    "/sitemaps/static.xml",
  ]);

  return new Response(sitemapIndexXML, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
