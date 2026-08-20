import { ReviewArticleObservationSchema } from "@peated/server/externalReviews/observation";
import { load as cheerio, type CheerioAPI } from "cheerio";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { ScraperAdapter } from "../types";

const ORIGIN = "https://www.whiskynotes.be";
const TARGET = "whiskynotes";
const MAX_DISCOVERY_PAGES = 5;
const MAX_ARTICLES_PER_PAGE = 20;
const MAX_REVIEW_TEXT_LENGTH = 50_000;
const ARTICLE_PATH = /^\/\d{4}\/[^/]+\/[^/]+\/$/;
const EXCLUDED_CATEGORIES = new Set([
  "category-armagnac",
  "category-bars",
  "category-cognac",
  "category-distillery-visits",
  "category-other-spirits",
  "category-rum",
  "category-whisky-news",
]);

export const WhiskyNotesCursorSchema = z
  .object({
    page: z.number().int().min(1).max(MAX_DISCOVERY_PAGES),
    processedArticleUrls: z.array(z.url()).max(MAX_ARTICLES_PER_PAGE),
  })
  .strict();

export const WhiskyNotesObservationSchema = z
  .object({
    article: ReviewArticleObservationSchema,
    reviewTexts: z.record(
      z.string().min(1).max(255),
      z.string().trim().min(1).max(MAX_REVIEW_TEXT_LENGTH),
    ),
  })
  .strict();

export type WhiskyNotesCursor = z.infer<typeof WhiskyNotesCursorSchema>;
export type WhiskyNotesObservation = z.infer<
  typeof WhiskyNotesObservationSchema
>;

function normalizeText(value: string): string {
  return value.replaceAll(/\s+/g, " ").trim();
}

function articleUrl(value: string): URL | null {
  try {
    const url = new URL(value, ORIGIN);
    url.hash = "";
    url.search = "";
    if (url.origin !== ORIGIN || !ARTICLE_PATH.test(url.pathname)) return null;
    return url;
  } catch {
    return null;
  }
}

export function discoverWhiskyNotesArticles(data: string): URL[] {
  const $ = cheerio(data);
  const discovered = new Map<string, URL>();

  $("#featured article, #posts article").each((_, element) => {
    const categories = new Set(($(element).attr("class") ?? "").split(/\s+/));
    if ([...EXCLUDED_CATEGORIES].some((name) => categories.has(name))) return;

    const href = $("a.entry-permalink", element).first().attr("href");
    if (!href) return;
    const url = articleUrl(href);
    if (url) discovered.set(url.href, url);
  });

  return [...discovered.values()].slice(0, MAX_ARTICLES_PER_PAGE);
}

function hasNextArchivePage($: CheerioAPI): boolean {
  return $('link[rel="next"]').length > 0;
}

function score(value: string) {
  const matches = [...value.matchAll(/(\d{1,3}(?:[.,]\d+)?)\s*\/\s*100\b/giu)];
  const match = matches.at(-1);
  if (!match?.[1]) return null;
  const nativeValue = Number(match[1].replace(",", "."));
  if (!Number.isFinite(nativeValue) || nativeValue < 0 || nativeValue > 100) {
    return null;
  }
  return {
    nativeScore: {
      value: nativeValue,
      scale: 100,
      display: `${match[1]}/100`,
    },
    normalizedRating: Math.round(nativeValue),
  };
}

function bottleName(heading: string): string | null {
  const name = normalizeText(heading);
  return /^.+\s+\((?=[^)]*\d{1,3}(?:[.,]\d+)?\s*%)[^)]*\)\s*$/u.test(name)
    ? name
    : null;
}

function reviewSourceKey(canonicalUrl: string, heading: string): string {
  const digest = createHash("sha256")
    .update(
      `${canonicalUrl}\n${normalizeText(heading).toLocaleLowerCase("en")}`,
    )
    .digest("hex");
  return `whiskynotes:${digest}`;
}

export function parseWhiskyNotesArticle(
  data: string,
  rawCanonicalUrl: URL,
): WhiskyNotesObservation {
  const canonicalUrl = articleUrl(rawCanonicalUrl.href);
  if (!canonicalUrl) throw new Error("Invalid WhiskyNotes article URL.");

  const $ = cheerio(data);
  const article = $("#main article.post").first();
  const title = normalizeText(article.find(".entry-title").first().text());
  const reviewerName =
    normalizeText(article.find(".author.vcard").first().text()) || null;
  const publishedValue = article
    .find("time.entry-date.published")
    .first()
    .attr("datetime");
  const publishedAt = publishedValue ? new Date(publishedValue) : null;
  if (!title) throw new Error("WhiskyNotes article title is missing.");
  if (publishedAt && Number.isNaN(publishedAt.getTime())) {
    throw new Error("WhiskyNotes article date is invalid.");
  }

  const content = article.find(".entry-content").first().clone();
  content
    .find(".yarpp, .heateor_sss_sharing_container, script, style, noscript")
    .remove();
  const contentText = normalizeText(content.text());
  if (!contentText) throw new Error("WhiskyNotes article content is missing.");

  const reviewList = [];
  const reviewTexts: Record<string, string> = {};
  const headings = content
    .find("h2")
    .toArray()
    .filter((heading) => bottleName($(heading).text()) !== null);
  const rawPageScore = normalizeText(
    article.find(".entry-score").first().text(),
  );
  const pageScore = /^\d{1,3}(?:[.,]\d+)?$/.test(rawPageScore)
    ? score(`${rawPageScore}/100`)
    : null;

  for (const [index, heading] of headings.entries()) {
    const headingText = normalizeText($(heading).text());
    const name = bottleName(headingText);
    if (name === null) continue;
    const sectionText = normalizeText(
      [
        headingText,
        ...$(heading)
          .nextUntil("h2")
          .toArray()
          .map((node) => $(node).text()),
      ].join(" "),
    );
    const sourceKey = reviewSourceKey(canonicalUrl.href, headingText);
    const reviewScore = score(sectionText) ?? (index === 0 ? pageScore : null);
    reviewList.push({
      sourceKey,
      name,
      reviewerName,
      nativeScore: reviewScore?.nativeScore ?? null,
      normalizedRating: reviewScore?.normalizedRating ?? null,
    });
    reviewTexts[sourceKey] = sectionText;
  }

  if (reviewList.length === 0) {
    throw new Error("WhiskyNotes article contains no review headings.");
  }

  return WhiskyNotesObservationSchema.parse({
    article: {
      canonicalUrl: canonicalUrl.href,
      title,
      issue: null,
      publishedAt,
      contentHash: createHash("sha256").update(contentText).digest("hex"),
      reviews: reviewList,
    },
    reviewTexts,
  });
}

function archiveUrl(page: number): URL {
  return new URL(page === 1 ? "/" : `/page/${page}/`, ORIGIN);
}

export const whiskyNotesAdapter: ScraperAdapter<
  WhiskyNotesCursor,
  WhiskyNotesObservation
> = async ({ cursor, session }) => {
  let page = cursor?.page ?? 1;
  let processedArticleUrls = new Set(cursor?.processedArticleUrls ?? []);

  while (page <= MAX_DISCOVERY_PAGES) {
    const listingResponse = await session.request({
      target: TARGET,
      url: archiveUrl(page),
    });
    const articleUrls = discoverWhiskyNotesArticles(listingResponse.body);

    for (const discoveredUrl of articleUrls) {
      if (processedArticleUrls.has(discoveredUrl.href)) continue;
      const articleResponse = await session.request({
        target: TARGET,
        url: discoveredUrl,
      });
      const observation = parseWhiskyNotesArticle(
        articleResponse.body,
        articleResponse.url,
      );
      await session.emit({
        sourceKey: observation.article.canonicalUrl,
        itemCount: observation.article.reviews.length,
        value: observation,
      });
      processedArticleUrls.add(discoveredUrl.href);
      await session.checkpoint({
        page,
        processedArticleUrls: [...processedArticleUrls],
      });
    }

    if (page === MAX_DISCOVERY_PAGES) return;
    if (!hasNextArchivePage(cheerio(listingResponse.body))) return;
    page += 1;
    processedArticleUrls = new Set();
    await session.checkpoint({ page, processedArticleUrls: [] });
  }
};
