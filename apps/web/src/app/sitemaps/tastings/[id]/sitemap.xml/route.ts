import { createAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { buildPagesSitemap } from "@peated/web/lib/sitemaps";
import { loadTastingSitemapPage } from "@peated/web/lib/tastingSitemaps";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  const page = Number(id);
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(page)) {
    return new Response(null, { status: 404 });
  }

  // Tasting sitemaps always use anonymous visibility, including signed-in requests.
  const { client } = await createAnonymousServerClient();
  const pages = await loadTastingSitemapPage(page, client.tastings.list);
  const xml = await buildPagesSitemap(pages);

  return new Response(xml, {
    headers: {
      "Cache-Control":
        "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
      "Content-Type": "application/xml",
    },
  });
}
