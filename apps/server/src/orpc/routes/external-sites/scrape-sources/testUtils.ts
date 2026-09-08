import type { ScrapeRules } from "@peated/server/scraper/configured/rules";
import {
  createScrapeSourceRevision,
  createSiteWithScrapeSource,
} from "@peated/server/scraper/configured/service";

export const reviewRules = {
  kind: "review" as const,
  list: {
    links: "li a.review",
    nextPage: null,
    limit: 5,
  },
  detail: {
    url: null,
    title: "h1",
    date: "time",
    reviews: {
      area: "body",
      item: "article.review",
      name: "h2",
      reviewer: null,
      tastingNotes: null,
      score: null,
    },
  },
} satisfies ScrapeRules;

export async function createTestSource(
  createdById: number,
  options: { host?: string } = {},
) {
  const host = options.host ?? "route-reviews";
  return await createSiteWithScrapeSource({
    createdById,
    kind: "review",
    websiteUrl: `https://${host}.example/archive`,
    name: "Route Reviews",
  });
}

export async function createTestRevision(
  scrapeSourceId: number,
  createdById: number,
) {
  return await createScrapeSourceRevision({
    author: "person",
    createdById,
    rules: reviewRules,
    scrapeSourceId,
  });
}
