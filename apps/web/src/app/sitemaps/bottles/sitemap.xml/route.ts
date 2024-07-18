import { buildSitemapIndex } from "@peated/web/lib/sitemaps";
import { getTrpcClient } from "@peated/web/lib/trpc/client.server";

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
  const trpcClient = await getTrpcClient();
  const { totalBottles } = await trpcClient.stats.fetch();
  const sitemapIndexXML = await buildSitemapIndex(
    range(1, Math.ceil(totalBottles / PAGE_LIMIT)).map(
      (i) => `/sitemaps/bottles/${i}/sitemap.xml`,
    ),
  );

  return new Response(sitemapIndexXML, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
