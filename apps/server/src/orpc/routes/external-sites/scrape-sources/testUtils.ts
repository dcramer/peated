import type { ScrapeRules } from "@peated/server/scraper/configured/rules";
import {
  createScrapeSourceRevision,
  createSiteWithScrapeSource,
} from "@peated/server/scraper/configured/service";

export const reviewRules = {
  kind: "review" as const,
  articles: {
    oneArticlePer: "li",
    link: "a.review",
    skipWhen: null,
    nextPage: null,
    limit: 5,
  },
  article: {
    canonicalUrl: null,
    title: {
      try: [
        {
          get: "text" as const,
          selector: "h1",
          take: "first" as const,
          startsWith: null,
          clean: null,
        },
      ],
    },
    publishedDate: {
      try: [{ get: "fixed" as const, value: "2026-01-01", clean: null }],
    },
    reviews: {
      inside: "body",
      oneReviewPer: "element" as const,
      selector: "article.review",
      name: {
        try: [
          {
            get: "text" as const,
            from: "review" as const,
            selector: "h2",
            take: "first" as const,
            startsWith: null,
            clean: null,
          },
        ],
      },
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
