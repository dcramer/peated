import { load } from "cheerio";
import type { ScrapeSourceKind } from "./rules";

export const MAX_LIKELY_LIST_PAGES = 4;

const SYNDICATION_TYPES = new Set([
  "application/atom+xml",
  "application/rdf+xml",
  "application/rss+xml",
]);

const SYNDICATION_PATH = /(?:^|[/.\-_])(atom|feed|rss)(?:$|[/.\-_])/i;

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
  catalog: [
    "whisky",
    "whiskey",
    "range",
    "ranges",
    "catalog",
    "collection",
    "collections",
    "product",
    "products",
  ],
} as const satisfies Record<ScrapeSourceKind, readonly string[]>;

const NON_DETAIL_WORDS = new Set([
  "about",
  "account",
  "cart",
  "contact",
  "help",
  "login",
  "privacy",
  "search",
  "terms",
]);

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

function sameWebsiteUrl(href: string, pageUrl: URL) {
  try {
    const url = new URL(href, pageUrl);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.origin !== pageUrl.origin ||
      url.username ||
      url.password
    ) {
      return null;
    }
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function looksLikeSyndicationLink(url: URL, text: string) {
  return (
    url.pathname.toLowerCase().endsWith(".xml") ||
    SYNDICATION_PATH.test(url.pathname) ||
    /\b(atom|feed|rss)\b/i.test(text)
  );
}

/** Finds public feeds advertised by the website, with standard metadata first. */
export function findAdvertisedSyndicationPages(input: {
  pageUrl: URL;
  html: string;
}) {
  const $ = load(input.html);
  const found = new Map<string, { priority: number; order: number }>();
  let order = 0;

  for (const element of $("link[href], a[href], area[href]").toArray()) {
    order += 1;
    const href = $(element).attr("href");
    if (!href) continue;
    const value = sameWebsiteUrl(href, input.pageUrl);
    if (!value || value === input.pageUrl.toString()) continue;

    const tagName = element.tagName.toLowerCase();
    const type = ($(element).attr("type") ?? "")
      .split(";", 1)[0]
      ?.trim()
      .toLowerCase();
    const alternate = ($(element).attr("rel") ?? "")
      .toLowerCase()
      .split(/\s+/)
      .includes("alternate");
    const typedFeed = type ? SYNDICATION_TYPES.has(type) : false;
    const namedFeed = looksLikeSyndicationLink(
      new URL(value),
      $(element).text(),
    );
    const eligibleTypedFeed =
      tagName === "link" ? alternate && typedFeed : typedFeed;
    const eligibleNamedFeed =
      tagName === "link" ? alternate && namedFeed : namedFeed;
    const priority =
      tagName === "link" && alternate && typedFeed
        ? 3
        : eligibleTypedFeed
          ? 2
          : eligibleNamedFeed
            ? 1
            : 0;
    if (priority === 0) continue;

    const current = found.get(value);
    if (!current || priority > current.priority) {
      found.set(value, { priority, order });
    }
  }

  return [...found.entries()]
    .sort(([, left], [, right]) =>
      right.priority === left.priority
        ? left.order - right.order
        : right.priority - left.priority,
    )
    .map(([url]) => url);
}

export type SyndicationFeed = {
  format: "atom" | "rdf" | "rss";
  links: string[];
};

/** Accepts only a recognizable feed with usable links on the source website. */
export function inspectSyndicationFeed(input: {
  pageUrl: URL;
  xml: string;
}): SyndicationFeed | null {
  const $ = load(input.xml, { xmlMode: true });
  const root = $.root().children().first();
  const rootName = root.prop("tagName")?.toLowerCase();
  const format =
    rootName === "rss"
      ? "rss"
      : rootName === "feed"
        ? "atom"
        : rootName === "rdf:rdf"
          ? "rdf"
          : null;
  if (!format) return null;

  const items =
    format === "atom"
      ? root.children("entry").toArray()
      : format === "rss"
        ? root.children("channel").first().children("item").toArray()
        : root.children("item").toArray();
  const links = new Set<string>();
  for (const item of items) {
    const raw =
      format === "atom"
        ? $(item)
            .children("link")
            .filter((_, link) => {
              const rel = $(link).attr("rel");
              return !rel || rel.toLowerCase() === "alternate";
            })
            .first()
            .attr("href")
        : $(item).children("link").first().text().trim();
    if (!raw) continue;
    const value = sameWebsiteUrl(raw, input.pageUrl);
    if (value) links.add(value);
  }
  if (links.size === 0) return null;
  return { format, links: [...links] };
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

export function findLikelyDetailPages(input: {
  kind: ScrapeSourceKind;
  limit: number;
  pages: Array<{ url: string; html: string }>;
}) {
  const pageUrls = new Set(
    input.pages.map((page) => new URL(page.url).toString()),
  );
  const found = new Map<string, { score: number; order: number }>();
  let order = 0;

  for (const page of input.pages) {
    const pageUrl = new URL(page.url);
    const feed = inspectSyndicationFeed({ pageUrl, xml: page.html });
    if (feed) {
      for (const url of feed.links) {
        order += 1;
        if (pageUrls.has(url)) continue;
        found.set(url, { score: 100, order });
      }
    }
    const $ = load(page.html);
    for (const element of $("a[href]").toArray()) {
      order += 1;
      const href = $(element).attr("href");
      if (!href) continue;
      try {
        const url = new URL(href, pageUrl);
        url.hash = "";
        if (
          !["http:", "https:"].includes(url.protocol) ||
          url.origin !== pageUrl.origin ||
          url.username ||
          url.password ||
          pageUrls.has(url.toString()) ||
          (url.pathname === pageUrl.pathname && url.search !== pageUrl.search)
        ) {
          continue;
        }
        const pathParts = url.pathname
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter(Boolean);
        if (pathParts.some((part) => NON_DETAIL_WORDS.has(part))) continue;

        const textParts = $(element)
          .text()
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter(Boolean);
        const words = LIST_PAGE_WORDS[input.kind];
        const wordScore = words.reduce(
          (score, word) =>
            score +
            (pathParts.includes(word) ? 8 : 0) +
            (textParts.includes(word) ? 2 : 0),
          0,
        );
        const structured = $(element).closest("article").length > 0;
        const className = $(element)
          .parents()
          .addBack()
          .map((_, parent) => $(parent).attr("class") ?? "")
          .get()
          .join(" ");
        const itemClass = /(?:card|entry|item|post|product|review)/i.test(
          className,
        );
        const score =
          wordScore +
          (structured ? 6 : 0) +
          (itemClass ? 6 : 0) +
          Math.min(pathParts.length, 4);
        if (score < 6) continue;
        const current = found.get(url.toString());
        if (!current || score > current.score) {
          found.set(url.toString(), { score, order });
        }
      } catch {
        // Ignore malformed links from the remote page.
      }
    }
  }

  return [...found.entries()]
    .sort(([, left], [, right]) =>
      right.score === left.score
        ? left.order - right.order
        : right.score - left.score,
    )
    .slice(0, input.limit)
    .map(([url]) => url);
}
