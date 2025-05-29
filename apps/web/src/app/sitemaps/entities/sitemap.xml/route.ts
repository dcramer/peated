import { createServerClient } from "@peated/web/lib/orpc/client.server";
import { buildSitemapIndex } from "@peated/web/lib/sitemaps";

const PAGE_LIMIT = 1000;

function range(end: number, _: number): number[];
function range(start: number, end?: number): number[] {
  if (end === undefined) {
    end = start;
    start = 0;
  }
  const r = [];
  for (let i = start; i <= end; i++) {
    r.push(i);
  }
  return r;
}

export async function GET() {
  const { client } = await createServerClient();

  const { totalEntities } = await client.stats();
  const sitemapIndexXML = await buildSitemapIndex(
    range(1, Math.ceil(totalEntities / PAGE_LIMIT)).map(
      (i) => `/sitemaps/entities/${i}/sitemap.xml`,
    ),
  );

  return new Response(sitemapIndexXML, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
