import {
  createScrapeSourceRevision,
  createSiteWithScrapeSource,
} from "@peated/server/scraper/configured/service";

export const reviewRules = {
  kind: "review" as const,
  list: {
    detailLink: { selector: "a.review", attribute: "href" as const },
    maxItems: 5,
  },
  detail: {
    title: { selector: "h1" },
    reviewItem: "article.review",
    name: { selector: "h2" },
  },
};

export async function createTestSource(
  createdById: number,
  options: { allowAiSuggestions?: boolean; host?: string } = {},
) {
  const host = options.host ?? "route-reviews";
  return await createSiteWithScrapeSource({
    allowAiSuggestions: options.allowAiSuggestions,
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
