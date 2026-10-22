import type { Outputs } from "@peated/server/orpc/router";
import type { Sitemap } from "./sitemaps";
import { getBottleUrl } from "./urls";

export type ListSitemapBottles = (input: {
  page: number;
}) => Promise<Outputs["bottles"]["sitemap"]>;

export async function loadBottleSitemapPage(
  page: number,
  listBottles: ListSitemapBottles,
): Promise<Sitemap> {
  const { results } = await listBottles({ page });

  return results.map((bottle) => ({
    url: getBottleUrl(bottle),
    lastModified: bottle.updatedAt,
  }));
}
