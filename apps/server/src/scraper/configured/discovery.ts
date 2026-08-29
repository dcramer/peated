import { load } from "cheerio";
import type { ScrapeSourceKind } from "./rules";

export const MAX_LIKELY_LIST_PAGES = 4;

const LIST_PAGE_WORDS = {
  review: ["review", "reviews", "rating", "ratings", "tasting", "archive"],
  price: [
    "shop",
    "store",
    "catalog",
    "collection",
    "collections",
    "product",
    "products",
  ],
} as const satisfies Record<ScrapeSourceKind, readonly string[]>;

function scoreLink(url: URL, text: string, kind: ScrapeSourceKind) {
  const pathParts = url.pathname
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const textParts = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const words = LIST_PAGE_WORDS[kind];
  const pathScore = words.reduce(
    (score, word) => score + (pathParts.includes(word) ? 10 : 0),
    0,
  );
  const textScore = words.reduce(
    (score, word) => score + (textParts.includes(word) ? 3 : 0),
    0,
  );
  return pathScore + textScore - pathParts.length;
}

export function findLikelyListPages(input: {
  kind: ScrapeSourceKind;
  pageUrl: URL;
  html: string;
}) {
  const $ = load(input.html);
  const found = new Map<string, { score: number; order: number }>();

  for (const [order, element] of $("a[href]").toArray().entries()) {
    const href = $(element).attr("href");
    if (!href) continue;
    try {
      const url = new URL(href, input.pageUrl);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.origin !== input.pageUrl.origin ||
        url.username ||
        url.password
      ) {
        continue;
      }
      url.hash = "";
      if (url.toString() === input.pageUrl.toString()) continue;
      const score = scoreLink(url, $(element).text(), input.kind);
      if (score <= 0) continue;
      const current = found.get(url.toString());
      if (!current || score > current.score) {
        found.set(url.toString(), { score, order });
      }
    } catch {
      // Ignore malformed links from the remote page.
    }
  }

  return [...found.entries()]
    .sort(([, left], [, right]) =>
      right.score === left.score
        ? left.order - right.order
        : right.score - left.score,
    )
    .slice(0, MAX_LIKELY_LIST_PAGES)
    .map(([url]) => url);
}
