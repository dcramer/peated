import { ExternalReviewArticleIngestionSchema } from "@peated/server/externalReviews/observation";
import { load as cheerio, type CheerioAPI } from "cheerio";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { ScraperAdapter } from "../types";
import { parseDate } from "./dates";

const ORIGIN = "https://www.whiskynotes.be";
const TARGET = "whiskynotes";
const MAX_HISTORY_PAGES_PER_RUN = 4;
const MAX_ARTICLES_PER_PAGE = 20;
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
    page: z.number().int().min(1),
    processedArticleUrls: z.array(z.url()).max(MAX_ARTICLES_PER_PAGE),
    currentArticleUrls: z.array(z.url()).max(MAX_ARTICLES_PER_PAGE).default([]),
    historyComplete: z.boolean().default(false),
  })
  .strict();

export const WhiskyNotesObservationSchema =
  ExternalReviewArticleIngestionSchema;

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
  const nativeScore = {
    value: nativeValue,
    scale: 100,
    display: `${match[1]}/100`,
  };
  return {
    nativeScore,
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
  const publishedAt = publishedValue ? parseDate(publishedValue) : null;
  if (!title) throw new Error("WhiskyNotes article title is missing.");
  if (publishedValue && !publishedAt) {
    throw new Error("WhiskyNotes article date is invalid.");
  }

  const content = article.find(".entry-content").first().clone();
  content
    .find(".yarpp, .heateor_sss_sharing_container, script, style, noscript")
    .remove();
  const contentText = normalizeText(content.text());
  if (!contentText) throw new Error("WhiskyNotes article content is missing.");

  const reviewList = [];
  const externalReviewTexts: Record<string, string> = {};
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
    });
    externalReviewTexts[sourceKey] = sectionText;
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
      externalReviews: reviewList,
    },
    externalReviewTexts,
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
  let currentArticleUrls = new Set(cursor?.currentArticleUrls ?? []);
  let historyComplete = cursor?.historyComplete ?? false;

  const checkpoint = async () => {
    await session.checkpoint({
      page,
      processedArticleUrls: [...processedArticleUrls],
      currentArticleUrls: [...currentArticleUrls],
      historyComplete,
    });
  };

  const emitArticle = async (discoveredUrl: URL) => {
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
      itemCount: observation.article.externalReviews.length,
      value: observation,
    });
  };

  const currentResponse = await session.request({
    target: TARGET,
    url: archiveUrl(1),
  });
  const currentUrls = discoverWhiskyNotesArticles(currentResponse.body);
  if (currentUrls.length === 0) {
    throw new Error("WhiskyNotes current archive contains no review articles.");
  }
  const currentUrlSet = new Set(currentUrls.map((url) => url.href));
  currentArticleUrls = new Set(
    [...currentArticleUrls].filter((url) => currentUrlSet.has(url)),
  );

  for (const discoveredUrl of currentUrls) {
    const isHistoryPage = page === 1 && !historyComplete;
    if (
      currentArticleUrls.has(discoveredUrl.href) ||
      (isHistoryPage && processedArticleUrls.has(discoveredUrl.href))
    ) {
      currentArticleUrls.add(discoveredUrl.href);
      if (isHistoryPage) processedArticleUrls.add(discoveredUrl.href);
      continue;
    }
    await emitArticle(discoveredUrl);
    currentArticleUrls.add(discoveredUrl.href);
    if (isHistoryPage) processedArticleUrls.add(discoveredUrl.href);
    await checkpoint();
  }
  await checkpoint();

  if (historyComplete) return;

  let completedPages = 0;
  while (completedPages < MAX_HISTORY_PAGES_PER_RUN) {
    const listingResponse =
      page === 1
        ? currentResponse
        : await session.request({
            target: TARGET,
            url: archiveUrl(page),
          });
    const articleUrls = discoverWhiskyNotesArticles(listingResponse.body);

    for (const discoveredUrl of articleUrls) {
      if (processedArticleUrls.has(discoveredUrl.href)) continue;
      await emitArticle(discoveredUrl);
      processedArticleUrls.add(discoveredUrl.href);
      await checkpoint();
    }

    completedPages += 1;
    if (!hasNextArchivePage(cheerio(listingResponse.body))) {
      historyComplete = true;
      await checkpoint();
      return;
    }
    page += 1;
    processedArticleUrls = new Set();
    await checkpoint();
  }
};
