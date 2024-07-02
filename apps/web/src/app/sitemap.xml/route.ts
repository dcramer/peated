import config from "@peated/web/config";

export const dynamic = "force-static";

async function buildSitemapIndex(sitemaps: string[]) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>';
  xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

  const baseUrl = config.URL_PREFIX;
  for (const url of sitemaps) {
    xml += "<sitemap>";
    xml += `<loc>${baseUrl}${url}</loc>`;
    xml += "</sitemap>";
  }

  xml += "</sitemapindex>";
  return xml;
}

export async function GET() {
  const sitemapIndexXML = await buildSitemapIndex([
    "/sitemaps/bottles.xml",
    "/sitemaps/entities.xml",
    "/sitemaps/locations.xml",
    "/sitemaps/static.xml",
  ]);

  return new Response(sitemapIndexXML, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
