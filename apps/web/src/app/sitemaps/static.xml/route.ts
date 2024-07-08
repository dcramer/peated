import { buildPagesSitemap } from "@peated/web/lib/sitemaps";

export const revalidate = 86400;

export async function GET() {
  const pagesSitemapXML = await buildPagesSitemap([
    { url: "/about" },
    { url: "/entities/4263/codes" },
  ]);

  return new Response(pagesSitemapXML, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
