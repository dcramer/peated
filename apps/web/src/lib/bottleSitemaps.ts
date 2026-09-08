import type { Sitemap } from "./sitemaps";
import { getBottleUrlFromFullName } from "./urls";

type SitemapBottle = {
  id: number;
  fullName: string;
  updatedAt: string;
};

export type ListSitemapBottles = (input: {
  page: number;
}) => Promise<{ results: SitemapBottle[] }>;

export async function loadBottleSitemapPage(
  page: number,
  listBottles: ListSitemapBottles,
): Promise<Sitemap> {
  const { results } = await listBottles({ page });

  return results.map((bottle) => ({
    url: getBottleUrlFromFullName(bottle),
    lastModified: bottle.updatedAt,
  }));
}
