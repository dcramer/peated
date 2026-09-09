import type { ExternalReviewArticleIngestion } from "@peated/server/externalReviews/observation";
import { ExternalReviewArticleIngestionSchema } from "@peated/server/externalReviews/observation";
import {
  CatalogListingInputSchema,
  StorePriceInputSchema,
} from "@peated/server/schemas";
import { load } from "cheerio";
import { createHash } from "node:crypto";
import { z } from "zod";
import { readReviewBody } from "../adapters/reviewBody";
import type { ScrapeIssue } from "./preview";
import { reviewSourceKey } from "./reviewSourceKey";
import type {
  ScrapePageRead,
  ScrapeRules,
  ScrapeValue,
  ScrapeValueSelectorV1,
  StoredScrapePageField,
  StoredScrapePageRead,
  StoredScrapeReviewField,
  StoredScrapeRules,
} from "./rules";
import { normalizeScrapeReviewNameRule } from "./rules";
import {
  applyDetailPageUrlCompatibility,
  readCompatiblePublishedDate,
} from "./sourceCompatibility";
import { matchFirstText, matchText } from "./textTemplate";

export type ScrapeListResult = {
  links: string[];
  nextPageUrl: string | null;
  issues: ScrapeIssue[];
};

export type ScrapeDetailResult =
  | {
      kind: "review";
      value: ExternalReviewArticleIngestion | null;
      issues: ScrapeIssue[];
    }
  | {
      kind: "price";
      value: z.infer<typeof StorePriceInputSchema>[];
      issues: ScrapeIssue[];
    }
  | {
      kind: "catalog";
      value: z.infer<typeof CatalogListingInputSchema>[];
      issues: ScrapeIssue[];
    };

type ScrapeReadableValue = ScrapeValue | ScrapeValueSelectorV1;
type SavedReviewRules = Extract<
  StoredScrapeRules,
  { kind: "review"; article: unknown }
>;
type SavedPriceRules = Extract<
  StoredScrapeRules,
  { kind: "price"; product: unknown }
>;
type SavedCatalogRules = Extract<
  StoredScrapeRules,
  { kind: "catalog"; product: unknown }
>;
type SavedRules = Extract<
  StoredScrapeRules,
  { articles: unknown } | { products: unknown }
>;
type LegacyReviewRules = Extract<
  StoredScrapeRules,
  { kind: "review"; list: { detailLink: unknown } }
>;
type LegacyPriceRules = Extract<
  StoredScrapeRules,
  { kind: "price"; list: { detailLink: unknown } }
>;
type EarlyRules = LegacyReviewRules | LegacyPriceRules;
type ScrapePageReadV6 = Extract<StoredScrapePageRead, { clean: unknown }>;
const JsonLdValueSchema = z.json();
const JsonLdObjectSchema = z.record(z.string(), JsonLdValueSchema);
type JsonLdValue = z.infer<typeof JsonLdValueSchema>;

function normalizeValue(value: string | undefined) {
  return value?.replaceAll(/\s+/g, " ").trim() || null;
}

const TEXT_LINE_BREAK = "\uE000";

function readText(element: ReturnType<ReturnType<typeof load>>) {
  const selected = element.clone();
  selected.find("br").replaceWith(TEXT_LINE_BREAK);
  return selected
    .text()
    .split(TEXT_LINE_BREAK)
    .map((line) => line.replaceAll(/\s+/gu, " ").trim())
    .join("\n")
    .replaceAll(/\n+/gu, "\n")
    .trim();
}

function cleanValue(value: string | null, rule: ScrapeReadableValue) {
  if (!value) return null;
  let result = value;
  if ("removePrefixes" in rule && rule.removePrefixes) {
    const normalized = result.toLowerCase();
    const prefix = rule.removePrefixes.find((candidate) =>
      normalized.startsWith(candidate.toLowerCase()),
    );
    if (prefix) result = result.slice(prefix.length).trim();
  }
  if ("removeSuffixes" in rule && rule.removeSuffixes) {
    const normalized = result.toLowerCase();
    const suffix = rule.removeSuffixes.find((candidate) =>
      normalized.endsWith(candidate.toLowerCase()),
    );
    if (suffix) result = result.slice(0, -suffix.length).trim();
  }
  if (!result) return null;
  if ("prefix" in rule && rule.prefix) result = `${rule.prefix}${result}`;
  if ("suffix" in rule && rule.suffix) result = `${result}${rule.suffix}`;
  return normalizeValue(result);
}

function readValue(root: ReturnType<typeof load>, rule: ScrapeReadableValue) {
  if ("value" in rule) return cleanValue(normalizeValue(rule.value), rule);

  if ("attribute" in rule && rule.attribute) {
    return cleanValue(
      normalizeValue(root(rule.selector).first().attr(rule.attribute)),
      rule,
    );
  }

  const values: string[] = [];
  const startsWith =
    "startsWith" in rule
      ? rule.startsWith?.map((value) => value.toLowerCase())
      : undefined;
  root(rule.selector).each((_, element) => {
    const selected = root(element).clone();
    selected.find("br").replaceWith(" ");
    const value = normalizeValue(selected.text());
    if (!value) return;
    if (
      startsWith &&
      !startsWith.some((prefix) => value.toLowerCase().startsWith(prefix))
    ) {
      return;
    }
    values.push(value);
    if (!("all" in rule && rule.all) || values.length > 100) return false;
  });
  if (values.length > 100) {
    throw new Error("Value matched more than 100 elements.");
  }
  return cleanValue(
    normalizeValue("all" in rule && rule.all ? values.join(" ") : values[0]),
    rule,
  );
}

function cleanPageValue(
  value: string | null,
  clean: ScrapePageReadV6["clean"],
) {
  if (!value) return null;
  let result = value;
  if (clean?.removeStart) {
    const normalized = result.toLocaleLowerCase("en");
    const match = clean.removeStart.find((candidate) =>
      normalized.startsWith(candidate.toLocaleLowerCase("en")),
    );
    if (match) result = result.slice(match.length).trim();
  }
  if (clean?.removeEnd) {
    const normalized = result.toLocaleLowerCase("en");
    const match = clean.removeEnd.find((candidate) =>
      normalized.endsWith(candidate.toLocaleLowerCase("en")),
    );
    if (match) result = result.slice(0, -match.length).trim();
  }
  if (!result) return null;
  if (clean?.addStart) result = `${clean.addStart}${result}`;
  if (clean?.addEnd) result = `${result}${clean.addEnd}`;
  return normalizeValue(result);
}

function readPageValueV6(
  root: ReturnType<typeof load>,
  rule: ScrapePageReadV6,
) {
  if (rule.get === "fixed") {
    return cleanPageValue(normalizeValue(rule.value), rule.clean);
  }
  if (rule.get === "attribute") {
    return cleanPageValue(
      normalizeValue(root(rule.selector).first().attr(rule.attribute)),
      rule.clean,
    );
  }

  const values: string[] = [];
  const startsWith = rule.startsWith?.map((value) =>
    value.toLocaleLowerCase("en"),
  );
  root(rule.selector).each((_, element) => {
    const selected = root(element).clone();
    selected.find("br").replaceWith(" ");
    const value = normalizeValue(selected.text());
    if (!value) return;
    if (
      startsWith &&
      !startsWith.some((prefix) =>
        value.toLocaleLowerCase("en").startsWith(prefix),
      )
    ) {
      return;
    }
    values.push(value);
    if (rule.take === "first" || values.length > 100) return false;
  });
  if (values.length > 100) {
    throw new Error("Value matched more than 100 elements.");
  }
  return cleanPageValue(
    normalizeValue(rule.take === "all" ? values.join(" ") : values[0]),
    rule.clean,
  );
}

function addToValue(value: string | null, rule: ScrapePageRead) {
  if (!value) return null;
  let result = value;
  if (rule.addStart) result = `${rule.addStart}${result}`;
  if (rule.addEnd) result = `${result}${rule.addEnd}`;
  return normalizeValue(result);
}

function readPageValueV8(root: ReturnType<typeof load>, rule: ScrapePageRead) {
  if (rule.get === "fixed") {
    return addToValue(normalizeValue(rule.value), rule);
  }
  if (rule.get === "attribute") {
    const raw = normalizeValue(
      root(rule.selector).first().attr(rule.attribute),
    );
    return addToValue(matchFirstText(raw ?? "", rule.match), rule);
  }

  const values: string[] = [];
  root(rule.selector).each((_, element) => {
    const value = matchFirstText(readText(root(element)), rule.match);
    if (!value) return;
    values.push(value);
    if (rule.take === "first" || values.length > 100) return false;
  });
  if (values.length > 100) {
    throw new Error("Value matched more than 100 elements.");
  }
  return addToValue(
    normalizeValue(rule.take === "all" ? values.join(" ") : values[0]),
    rule,
  );
}

function readPageValue(
  root: ReturnType<typeof load>,
  rule: StoredScrapePageRead,
) {
  return "clean" in rule
    ? readPageValueV6(root, rule)
    : readPageValueV8(root, rule);
}

function readPageField(
  root: ReturnType<typeof load>,
  field: StoredScrapePageField,
) {
  for (const rule of field.try) {
    const value = readPageValue(root, rule);
    if (value) return value;
  }
  return null;
}

function webUrl(value: string, baseUrl: URL) {
  const url = new URL(value, baseUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("URL must use HTTP or HTTPS.");
  }
  url.hash = "";
  return url.toString();
}

function sameWebsiteUrl(value: string, baseUrl: URL) {
  const url = new URL(webUrl(value, baseUrl));
  if (url.origin !== baseUrl.origin) {
    throw new Error("Pages must stay on the source website.");
  }
  return url.toString();
}

function detailPageUrl(value: string, listUrl: URL) {
  return applyDetailPageUrlCompatibility(
    new URL(sameWebsiteUrl(value, listUrl)),
  ).toString();
}

function parseSelectedLinks(
  rules: ScrapeRules,
  html: string,
  pageUrl: URL,
): ScrapeListResult {
  const xml =
    /^\s*(?:<\?xml\b[^>]*>\s*)?<(?:rss|feed|urlset|sitemapindex)\b/iu.test(
      html,
    );
  const $ = load(html, xml ? { xmlMode: true } : undefined);
  const issues: ScrapeIssue[] = [];
  const links = new Set<string>();

  let linkElements;
  try {
    linkElements = $(rules.list.links).toArray();
  } catch {
    return {
      links: [],
      nextPageUrl: null,
      issues: [{ field: "list.links", message: "CSS selector is not valid." }],
    };
  }
  for (const element of linkElements) {
    const raw = $(element).attr("href") ?? readText($(element));
    if (!raw) continue;
    try {
      links.add(detailPageUrl(raw, pageUrl));
    } catch (error) {
      issues.push({
        field: "list.links",
        message:
          error instanceof Error ? error.message : "Unable to read the link.",
      });
    }
    if (links.size >= rules.list.limit) break;
  }
  if (links.size === 0) {
    issues.push({ field: "list.links", message: "No links were found." });
  }

  let nextPageUrl: string | null = null;
  if (rules.list.nextPage) {
    try {
      const raw = $(rules.list.nextPage).first().attr("href");
      if (raw) nextPageUrl = sameWebsiteUrl(raw, pageUrl);
    } catch (error) {
      issues.push({
        field: "list.nextPage",
        message:
          error instanceof Error
            ? error.message
            : "Unable to read the next page link.",
      });
    }
  }

  return { links: [...links], nextPageUrl, issues };
}

export function parseScrapeList(
  rules: ScrapeRules,
  html: string,
  pageUrl: URL,
): ScrapeListResult {
  return parseDirectScrapeList(rules, html, pageUrl);
}

export function parseDirectScrapeList(
  rules: ScrapeRules,
  html: string,
  pageUrl: URL,
) {
  return parseSelectedLinks(rules, html, pageUrl);
}

export function parseEarlyScrapeList(
  rules: EarlyRules,
  html: string,
  pageUrl: URL,
): ScrapeListResult {
  const issues: ScrapeIssue[] = [];
  const links = new Set<string>();
  try {
    const $ = load(html);
    const itemSelector = "item" in rules.list ? rules.list.item : undefined;
    const excludeWhen =
      "excludeWhen" in rules.list ? rules.list.excludeWhen : undefined;
    const items = itemSelector ? $(itemSelector).toArray() : [null];
    for (const itemElement of items) {
      const item = itemElement ? load($.html(itemElement)) : $;
      if (excludeWhen && readValue(item, excludeWhen)) continue;
      for (const element of item(rules.list.detailLink.selector).toArray()) {
        const raw = rules.list.detailLink.attribute
          ? item(element).attr(rules.list.detailLink.attribute)
          : item(element).text();
        if (!raw?.trim()) continue;
        try {
          links.add(detailPageUrl(raw.trim(), pageUrl));
        } catch (error) {
          issues.push({
            field: "list.detailLink",
            message:
              error instanceof Error
                ? error.message
                : "Unable to parse selector.",
          });
        }
        if (links.size >= rules.list.maxItems) break;
      }
      if (links.size >= rules.list.maxItems) break;
    }
  } catch (error) {
    issues.push({
      field: "list.detailLink",
      message:
        error instanceof Error ? error.message : "Unable to parse selector.",
    });
  }
  if (links.size === 0) {
    issues.push({
      field: "list.detailLink",
      message: "The selector did not find any detail links.",
    });
  }
  let nextPageUrl: string | null = null;
  if (rules.list.nextPage) {
    const $ = load(html);
    const raw = readValue($, rules.list.nextPage);
    if (raw) {
      try {
        nextPageUrl = sameWebsiteUrl(raw, pageUrl);
      } catch (error) {
        issues.push({
          field: "list.nextPage",
          message:
            error instanceof Error
              ? error.message
              : "Unable to parse selector.",
        });
      }
    }
  }
  return { links: [...links], nextPageUrl, issues };
}

export function parseSavedScrapeList(
  rules: SavedRules,
  html: string,
  pageUrl: URL,
): ScrapeListResult {
  const document =
    "articles" in rules &&
    "document" in rules.articles &&
    rules.articles.document === "xml"
      ? "xml"
      : "html";
  const $ = load(html, document === "xml" ? { xmlMode: true } : undefined);
  const issues: ScrapeIssue[] = [];
  const links = new Set<string>();
  const list = rules.kind === "review" ? rules.articles : rules.products;
  const itemSelector =
    rules.kind === "review"
      ? rules.articles.oneArticlePer
      : rules.products.oneProductPer;
  const fieldRoot = rules.kind === "review" ? "articles" : "products";
  const itemElements = $(itemSelector).toArray();
  let skippedItemCount = 0;
  try {
    for (const itemElement of itemElements) {
      const item = load(
        $.html(itemElement),
        document === "xml" ? { xmlMode: true } : undefined,
      );
      if (list.skipWhen) {
        const skipWhen = list.skipWhen;
        const matches = item(skipWhen.selector).toArray();
        const shouldSkip = matches.some((element) => {
          if ("startsWith" in skipWhen) {
            const text = normalizeValue(item(element).text());
            if (!text) return false;
            const startsWith = skipWhen.startsWith?.map((value) =>
              value.toLocaleLowerCase("en"),
            );
            return (
              !startsWith ||
              startsWith.some((prefix) =>
                text.toLocaleLowerCase("en").startsWith(prefix),
              )
            );
          }
          if (skipWhen.match === null) return true;
          return Boolean(
            matchFirstText(readText(item(element)), skipWhen.match),
          );
        });
        if (shouldSkip) {
          skippedItemCount += 1;
          continue;
        }
      }
      const itemLinks = item(list.link).toArray();
      for (const element of itemLinks) {
        const raw =
          item(element).attr("href") ??
          (document === "xml" ? readText(item(element)) : null);
        if (!raw?.trim()) continue;
        try {
          links.add(detailPageUrl(raw.trim(), pageUrl));
        } catch (error) {
          issues.push({
            field: `${fieldRoot}.link`,
            message:
              error instanceof Error
                ? error.message
                : "Unable to read the page link.",
          });
        }
        if (links.size >= list.limit) break;
      }
      if (links.size >= list.limit) break;
    }
  } catch (error) {
    issues.push({
      field: `${fieldRoot}.link`,
      message:
        error instanceof Error ? error.message : "Unable to read the list.",
    });
  }
  const allItemsWereSkipped =
    itemElements.length > 0 && skippedItemCount === itemElements.length;
  if (links.size === 0 && !allItemsWereSkipped) {
    issues.push({
      field: `${fieldRoot}.link`,
      message: "No links were found.",
    });
  }

  let nextPageUrl: string | null = null;
  if (list.nextPage) {
    const raw = $(list.nextPage).first().attr("href");
    if (raw) {
      try {
        nextPageUrl = sameWebsiteUrl(raw, pageUrl);
      } catch (error) {
        issues.push({
          field: `${fieldRoot}.nextPage`,
          message:
            error instanceof Error
              ? error.message
              : "Unable to read the next page link.",
        });
      }
    }
  }
  return { links: [...links], nextPageUrl, issues };
}

function parseDate(value: string | null) {
  if (!value) return null;
  const normalizedValue = value.replaceAll(
    /\b(\d{1,2})(?:st|nd|rd|th)\b/giu,
    "$1",
  );
  const timestamp = Date.parse(normalizedValue);
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

function parseDateWithFormat(value: string, format: string) {
  // Rules v3 owns this token grammar; literals are escaped so saved rules cannot run regex code.
  const tokens: string[] = [];
  let pattern = "^";
  let offset = 0;
  for (const match of format.matchAll(/yyyy|yy|MM|dd|\*/g)) {
    const index = match.index;
    pattern += format
      .slice(offset, index)
      .replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const token = match[0];
    if (token === "*") {
      pattern += "[^/?#]*";
    } else {
      tokens.push(token);
      pattern += token === "yyyy" ? "(\\d{4})" : "(\\d{2})";
    }
    offset = index + token.length;
  }
  pattern += format.slice(offset).replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
  pattern += "$";

  const match = new RegExp(pattern, "u").exec(value);
  if (!match) return null;
  const values = new Map<string, number>();
  for (const [index, token] of tokens.entries()) {
    const value = Number(match[index + 1]);
    const prior = values.get(token);
    if (prior !== undefined && prior !== value) return null;
    values.set(token, value);
  }
  const fullYear = values.get("yyyy");
  const shortYear = values.get("yy");
  if (
    fullYear !== undefined &&
    shortYear !== undefined &&
    fullYear % 100 !== shortYear
  ) {
    return null;
  }
  const year = fullYear ?? (shortYear === undefined ? null : 2000 + shortYear);
  const month = values.get("MM");
  const day = values.get("dd");
  if (year === null || month === undefined || day === undefined) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null;
}

function parseDateFromUrl(url: URL, format: string) {
  return parseDateWithFormat(url.pathname, format);
}

function parseNumber(value: string | null) {
  if (!value) return null;
  const match = value.replaceAll(",", "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
}

function parseScore(value: string | null) {
  if (!value) return null;
  const labeled = value
    .replaceAll(",", "")
    .match(/(-?\d+(?:\.\d+)?)\s*(?:points?\b|\/\s*\d+)/iu);
  return labeled ? Number(labeled[1]) : parseNumber(value);
}

function parsePlainNumber(value: string) {
  const normalized = value.trim().replaceAll(",", "");
  if (!/^-?\d+(?:\.\d+)?$/u.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function parsePriceInSmallestUnit(value: string | null) {
  const number = parseNumber(value);
  if (number === null || number <= 0) return null;
  return Math.round(number * 100);
}

function parseDisplayedPrice(value: string | null) {
  if (!value) return null;
  const amounts = [
    ...value
      .replaceAll(",", "")
      .matchAll(
        /(?:[$£€]\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:USD|GBP|EUR)\b)/giu,
      ),
  ].map((match) => Number(match[1] ?? match[2]));
  const number = amounts.at(-1) ?? parseNumber(value);
  if (number === null || number <= 0) return null;
  return Math.round(number * 100);
}

function parseVolume(value: string | null) {
  if (!value) return null;
  const normalized = value.toLowerCase().replaceAll(",", "");
  const amount = normalized.match(/(-?\d+(?:\.\d+)?)\s*(ml|cl|l)(?:\b|$)/u);
  const labeled = normalized.match(
    /\bvolume\s*\(\s*(ml|cl|l)\s*\)\s*:?\s*(-?\d+(?:\.\d+)?)/u,
  );
  const numberText = amount?.[1] ?? labeled?.[2];
  const number = numberText ? Number(numberText) : parsePlainNumber(normalized);
  if (number === null || number <= 0) return null;
  const unit = amount?.[2] ?? labeled?.[1];
  if (unit === "cl") return Math.round(number * 10);
  if (unit === "l") return Math.round(number * 1000);
  return Math.round(number);
}

function parseAbv(value: string | null) {
  if (!value) return null;
  const match = value.match(
    /(?:\b(?:abv|alcohol)\s*:?\s*)?(\d+(?:\.\d+)?)\s*%(?:\s*(?:abv|vol(?:ume)?))?/iu,
  );
  return match ? Number(match[1]) : parsePlainNumber(value);
}

function parseStatedAge(value: string | null) {
  if (!value) return null;
  const range = value.match(
    /(\d+(?:\.\d+)?)\s*[-–—]\s*\d+(?:\.\d+)?\s*(?:years?\s*old|y\.?\s*o\.?)\b/iu,
  );
  if (range) return Number(range[1]);
  const match = value.match(
    /(\d+(?:\.\d+)?)\s*(?:years?\s*old|y\.?\s*o\.?)\b/iu,
  );
  return match ? Number(match[1]) : parsePlainNumber(value);
}

function parseReleaseYear(value: string | null) {
  if (!value) return null;
  const match = value.match(/\b(?:19|20)\d{2}\b/u);
  return match ? Number(match[0]) : parsePlainNumber(value);
}

function validationIssues(
  error: z.ZodError,
  fieldForPath: (path: PropertyKey[]) => string,
): ScrapeIssue[] {
  return error.issues.map((issue) => ({
    field: fieldForPath(issue.path),
    message: issue.message,
  }));
}

function reviewField(path: PropertyKey[]) {
  if (path[0] !== "article") return "detail";
  if (path[1] === "canonicalUrl") return "detail.canonicalUrl";
  if (path[1] === "title") return "detail.title";
  if (path[1] === "publishedAt") return "detail.publishedAt";
  if (path[1] !== "externalReviews") return "detail";
  if (path[3] === "name") return "detail.name";
  if (path[3] === "reviewerName") return "detail.reviewerName";
  if (path[3] === "nativeScore") return "detail.score";
  return "detail.reviewItem";
}

const PRICE_FIELDS = new Set([
  "name",
  "price",
  "currency",
  "volume",
  "url",
  "externalProductId",
  "imageUrl",
  "barcode",
]);

function priceField(path: PropertyKey[]) {
  const field = String(path[0] ?? "");
  return PRICE_FIELDS.has(field) ? `detail.${field}` : "detail";
}

function selectReviewItems(
  $: ReturnType<typeof load>,
  rule: LegacyReviewRules["detail"]["reviewItem"],
) {
  return $(rule)
    .toArray()
    .map((element) => ({
      body: $(element),
      item: load($.html(element)),
    }));
}

function parseReviewDetail(
  rules: LegacyReviewRules,
  html: string,
  pageUrl: URL,
): ScrapeDetailResult {
  const $ = load(html);
  const issues: ScrapeIssue[] = [];
  const parsedArticleFieldIssues = new Set<string>();
  const reportArticleFieldIssue = (
    field: "detail.canonicalUrl" | "detail.publishedAt",
    message: string,
  ) => {
    parsedArticleFieldIssues.add(field);
    issues.push({ field, message });
  };
  let canonicalUrl: URL | null = pageUrl;
  const canonicalUrlRule =
    "canonicalUrl" in rules.detail ? rules.detail.canonicalUrl : undefined;
  if (canonicalUrlRule) {
    const canonicalUrlText = readValue($, canonicalUrlRule);
    if (!canonicalUrlText) {
      canonicalUrl = null;
      reportArticleFieldIssue(
        "detail.canonicalUrl",
        "Required value was not found.",
      );
    } else {
      try {
        canonicalUrl = new URL(sameWebsiteUrl(canonicalUrlText, pageUrl));
      } catch (error) {
        canonicalUrl = null;
        reportArticleFieldIssue(
          "detail.canonicalUrl",
          error instanceof Error ? error.message : "URL is not valid.",
        );
      }
    }
  }
  const title = readValue($, rules.detail.title);
  const publishedAtRule = rules.detail.publishedAt;
  const publishedAtText =
    publishedAtRule && !("urlDateFormat" in publishedAtRule)
      ? readValue($, publishedAtRule)
      : null;
  const publishedAt =
    publishedAtRule && "urlDateFormat" in publishedAtRule
      ? canonicalUrl
        ? parseDateFromUrl(canonicalUrl, publishedAtRule.urlDateFormat)
        : null
      : parseDate(publishedAtText);
  if (
    !publishedAtRule ||
    (!publishedAtText && !("urlDateFormat" in publishedAtRule))
  ) {
    reportArticleFieldIssue(
      "detail.publishedAt",
      "Required value was not found.",
    );
  } else if (!publishedAt) {
    reportArticleFieldIssue("detail.publishedAt", "Date is not valid.");
  }
  const externalReviews: Array<{
    sourceKey: string;
    name: string;
    category: null;
    reviewerName: string | null;
    nativeScore: { value: number; scale: number; display: string } | null;
  }> = [];
  const externalReviewTexts: Record<string, string> = {};
  const externalReviewBodies: Record<string, string> = {};
  const reviewItems = selectReviewItems($, rules.detail.reviewItem);
  const reviewNodes = reviewItems.map(({ body }) => body.add(body.find("*")));
  const readReviewValue = (
    item: ReturnType<typeof load>,
    selector: ScrapeReadableValue,
  ) =>
    readValue(item, selector) ??
    (reviewItems.length === 1 ? readValue($, selector) : null);

  try {
    const reviewerSelector = rules.detail.reviewerName;
    const pageBylines =
      reviewerSelector && !("value" in reviewerSelector)
        ? $(reviewerSelector.selector).filter(
            (_, element) =>
              !reviewNodes.some((nodes) => nodes.index(element) >= 0),
          )
        : null;
    // Scraper parsing shares only one explicit page byline; a review's writer stays local.
    const pageReviewerName =
      reviewerSelector && "value" in reviewerSelector
        ? readValue($, reviewerSelector)
        : reviewerSelector && pageBylines?.length === 1
          ? cleanValue(
              normalizeValue(
                "attribute" in reviewerSelector && reviewerSelector.attribute
                  ? pageBylines.attr(reviewerSelector.attribute)
                  : pageBylines.text(),
              ),
              reviewerSelector,
            )
          : null;
    reviewItems.forEach(({ body, item }, index) => {
      const name = readReviewValue(item, rules.detail.name);
      if (!name) {
        issues.push({
          field: "detail.name",
          message: "Required value was not found.",
        });
        return;
      }
      const sourceKey = `${canonicalUrl?.toString() ?? pageUrl.toString()}#review-${index + 1}`;
      const reviewBody = readReviewBody(body);
      if (reviewBody) externalReviewBodies[sourceKey] = reviewBody;
      const reviewerName = reviewerSelector
        ? (readValue(item, reviewerSelector) ?? pageReviewerName)
        : null;
      const scoreRule = rules.detail.score;
      const scoreText = scoreRule
        ? (readValue(item, scoreRule.value) ??
          (reviewItems.length === 1 ? readValue($, scoreRule.value) : null))
        : null;
      const scoreMap =
        rules.detail.score && "map" in rules.detail.score
          ? rules.detail.score.map
          : undefined;
      const mappedScore = scoreMap?.find(
        (entry) =>
          entry.text.toLocaleLowerCase("en") ===
          scoreText?.toLocaleLowerCase("en"),
      )?.value;
      const scoreValue = scoreMap
        ? (mappedScore ?? null)
        : parseNumber(scoreText);
      if (scoreText && scoreValue === null) {
        issues.push({
          field: "detail.score",
          message: scoreMap
            ? "Score is not in the configured map."
            : "Score is not a number.",
        });
      }
      externalReviews.push({
        sourceKey,
        name,
        category: null,
        reviewerName,
        nativeScore:
          rules.detail.score && scoreValue !== null
            ? {
                value: scoreValue,
                scale: rules.detail.score.scale,
                display: scoreText ?? String(scoreValue),
              }
            : null,
      });
      if (rules.detail.reviewText) {
        const text = readReviewValue(item, rules.detail.reviewText);
        if (text) externalReviewTexts[sourceKey] = text.slice(0, 50_000);
      }
    });
  } catch (error) {
    issues.push({
      field: "detail.reviewItem",
      message:
        error instanceof Error ? error.message : "Unable to parse selector.",
    });
  }

  const result = ExternalReviewArticleIngestionSchema.safeParse({
    article: {
      canonicalUrl: canonicalUrl?.toString() ?? null,
      title,
      issue: null,
      publishedAt,
      contentHash: createHash("sha256").update(html).digest("hex"),
      externalReviews,
    },
    externalReviewTexts,
    externalReviewBodies,
  });
  if (!result.success) {
    issues.push(
      ...validationIssues(result.error, reviewField).filter(
        ({ field }) => !parsedArticleFieldIssues.has(field),
      ),
    );
    return { kind: "review", value: null, issues };
  }
  return { kind: "review", value: result.data, issues };
}

function parseStorePriceDetail(
  rules: LegacyPriceRules,
  html: string,
  pageUrl: URL,
): ScrapeDetailResult {
  const $ = load(html);
  let url = pageUrl.toString();
  if (rules.detail.url) {
    const value = readValue($, rules.detail.url);
    if (value) url = sameWebsiteUrl(value, pageUrl);
  }
  const price = {
    name: readValue($, rules.detail.name),
    price: parsePriceInSmallestUnit(readValue($, rules.detail.price)),
    currency: rules.detail.currency,
    volume: parseVolume(readValue($, rules.detail.volume)),
    url,
    externalProductId: rules.detail.externalProductId
      ? (readValue($, rules.detail.externalProductId) ?? undefined)
      : undefined,
    imageUrl: rules.detail.imageUrl
      ? (readValue($, rules.detail.imageUrl) ?? undefined)
      : undefined,
    barcode: rules.detail.barcode
      ? (readValue($, rules.detail.barcode) ?? undefined)
      : undefined,
  };
  const result = StorePriceInputSchema.safeParse(price);
  if (!result.success) {
    return {
      kind: "price",
      value: [],
      issues: validationIssues(result.error, priceField),
    };
  }
  return { kind: "price", value: [result.data], issues: [] };
}

function savedReviewField(path: PropertyKey[]) {
  if (path[0] !== "article") return "article";
  if (path[1] === "canonicalUrl") return "article.canonicalUrl";
  if (path[1] === "title") return "article.title";
  if (path[1] === "publishedAt") return "article.publishedDate";
  if (path[1] !== "externalReviews") return "article";
  if (path[3] === "name") return "article.reviews.name";
  if (path[3] === "reviewerName") return "article.reviews.reviewer";
  if (path[3] === "nativeScore") return "article.reviews.score";
  return "article.reviews";
}

function readSavedReviewField(
  page: ReturnType<typeof load>,
  review: ReturnType<typeof load>,
  field: StoredScrapeReviewField,
  index: number,
) {
  for (const rule of field.try) {
    if (rule.get === "fixed") {
      const value = readPageValue(review, rule);
      if (value) return value;
      continue;
    }
    if (rule.from === "article") {
      if (rule.useFor === "firstReview" && index !== 0) continue;
      const value = readPageValue(page, rule);
      if (value) return value;
      continue;
    }
    const value = readPageValue(review, rule);
    if (value) return value;
  }
  return null;
}

function selectSavedReviewItems(
  $: ReturnType<typeof load>,
  rules: SavedReviewRules["article"]["reviews"],
) {
  const areas = $(rules.inside).toArray();
  if (areas.length !== 1) {
    return null;
  }
  const areaElement = areas[0]!;
  const area = $(areaElement);
  if (rules.oneReviewPer === "element") {
    return area
      .find(rules.selector)
      .filter((_, element) =>
        "contains" in rules && rules.contains
          ? $(element).find(rules.contains).length > 0
          : true,
      )
      .toArray()
      .map((element) => ({
        body: $(element),
        item: load($.html(element)),
      }));
  }

  if (rules.oneReviewPer === "section") {
    const starts = area
      .find(rules.startsAt.selector)
      .filter((_, element) =>
        Boolean(matchFirstText(readText($(element)), rules.startsAt.match)),
      )
      .toArray();
    const stops = rules.stopBefore
      ? area
          .find(rules.stopBefore.selector)
          .filter((_, element) =>
            Boolean(
              matchFirstText(
                readText($(element)),
                rules.stopBefore?.match ?? null,
              ),
            ),
          )
          .toArray()
      : [];
    const children = area.contents().toArray();
    const childIndex = (element: (typeof starts)[number]) => {
      const directChild = $(element)
        .parents()
        .toArray()
        .find((ancestor) => ancestor.parent === areaElement);
      return children.indexOf(directChild ?? element);
    };
    const startsAt = starts.map(childIndex);
    if (
      startsAt.some(
        (start, index) => start < 0 || start === startsAt[index - 1],
      )
    ) {
      throw new Error(
        "Each review start must be in a separate part of the review area.",
      );
    }
    const stopsAt = stops.map(childIndex).filter((index) => index >= 0);
    return starts.map((_, index) => {
      const start = startsAt[index]!;
      const nextReview = startsAt[index + 1] ?? children.length;
      const nextStop = stopsAt.find((stop) => stop > start) ?? children.length;
      const end = Math.min(nextReview, nextStop);
      const includeFrom =
        starts.length === 1 && rules.whenOnlyOneReview === "useWholeArea"
          ? 0
          : start;
      const bodyNodes = children.slice(includeFrom, end);
      const body = $(bodyNodes);
      return {
        body,
        item: load(bodyNodes.map((element) => $.html(element)).join("")),
      };
    });
  }

  const headings = area.find(rules.selector).toArray();
  return headings.map((heading) => {
    if (headings.length === 1 && rules.whenOnlyOneReview === "useWholeArea") {
      const stop = rules.stopBefore
        ? area.find(rules.stopBefore).first()
        : null;
      const body = stop?.length ? $(stop.prevAll().toArray().reverse()) : area;
      return {
        body,
        item: load(
          body
            .toArray()
            .map((element) => $.html(element))
            .join(""),
        ),
      };
    }
    const stopSelector = [rules.selector, rules.stopBefore]
      .filter(Boolean)
      .join(", ");
    const body = $(heading).add($(heading).nextUntil(stopSelector));
    return {
      body,
      item: load(
        body
          .toArray()
          .map((element) => $.html(element))
          .join(""),
      ),
    };
  });
}

function readSavedPublishedDate(
  $: ReturnType<typeof load>,
  field: SavedReviewRules["article"]["publishedDate"],
  pageUrl: URL,
) {
  for (const rule of field.try) {
    if (rule.get === "dateFromUrl") {
      const date = parseDateFromUrl(pageUrl, rule.format);
      if (date) return date;
      continue;
    }
    if (rule.get === "dateFromAttribute") {
      const value = $(rule.selector).first().attr(rule.attribute);
      const date = value ? parseDateWithFormat(value, rule.format) : null;
      if (date) return date;
      continue;
    }
    const value = readPageValue($, rule);
    if (!value) continue;
    return parseDate(value);
  }
  return null;
}

function parseSavedReviewDetail(
  rules: SavedReviewRules,
  html: string,
  pageUrl: URL,
  keysUseNameAndWriter: boolean,
): ScrapeDetailResult {
  const $ = load(html);
  const issues: ScrapeIssue[] = [];
  let canonicalUrl: URL | null = pageUrl;
  if (rules.article.canonicalUrl) {
    const value = readPageField($, rules.article.canonicalUrl);
    if (!value) {
      canonicalUrl = null;
      issues.push({
        field: "article.canonicalUrl",
        message: "Required value was not found.",
      });
    } else {
      try {
        canonicalUrl = new URL(sameWebsiteUrl(value, pageUrl));
      } catch (error) {
        canonicalUrl = null;
        issues.push({
          field: "article.canonicalUrl",
          message: error instanceof Error ? error.message : "URL is not valid.",
        });
      }
    }
  }
  const title = readPageField($, rules.article.title);
  const publishedAt = readSavedPublishedDate(
    $,
    rules.article.publishedDate,
    canonicalUrl ?? pageUrl,
  );
  if (!title) {
    issues.push({
      field: "article.title",
      message: "Required value was not found.",
    });
  }
  if (!publishedAt) {
    issues.push({
      field: "article.publishedDate",
      message: "Required date was not found or was not valid.",
    });
  }

  const externalReviews: Array<{
    sourceKey: string;
    name: string;
    category: null;
    reviewerName: string | null;
    nativeScore: { value: number; scale: number; display: string } | null;
  }> = [];
  const externalReviewTexts: Record<string, string> = {};
  const externalReviewBodies: Record<string, string> = {};
  const reviewKeys = new Set<string>();
  const reviewItems = selectSavedReviewItems($, rules.article.reviews);
  if (!reviewItems) {
    issues.push({
      field: "article.reviews.inside",
      message: "The review area must match exactly once.",
    });
  } else if (reviewItems.length === 0) {
    issues.push({
      field:
        rules.article.reviews.oneReviewPer === "section"
          ? "article.reviews.startsAt"
          : "article.reviews.selector",
      message: "No reviews were found.",
    });
  }

  reviewItems?.forEach(({ body, item }, index) => {
    const name = readSavedReviewField(
      $,
      item,
      rules.article.reviews.name,
      index,
    );
    if (!name) {
      issues.push({
        field: "article.reviews.name",
        message: `Required value was not found for review ${index + 1}.`,
      });
      return;
    }
    const reviewerName = rules.article.reviews.reviewer
      ? readSavedReviewField($, item, rules.article.reviews.reviewer, index)
      : null;
    const sourceKey = keysUseNameAndWriter
      ? reviewSourceKey(name, reviewerName)
      : `${canonicalUrl?.toString() ?? pageUrl.toString()}#review-${index + 1}`;
    if (keysUseNameAndWriter) {
      if (reviewKeys.has(sourceKey)) {
        issues.push({
          field: "article.reviews.name",
          message:
            "Each review in an article must have a unique name and writer combination.",
        });
        return;
      }
      reviewKeys.add(sourceKey);
    }
    const scoreRule = rules.article.reviews.score;
    const scoreText = scoreRule
      ? readSavedReviewField($, item, scoreRule, index)
      : null;
    const mappedScore = scoreRule?.map?.find(
      (entry) =>
        entry.text.toLocaleLowerCase("en") ===
        scoreText?.toLocaleLowerCase("en"),
    )?.value;
    const scoreValue = scoreRule?.map
      ? (mappedScore ?? null)
      : parseNumber(scoreText);
    if (scoreText && scoreValue === null) {
      issues.push({
        field: "article.reviews.score",
        message: scoreRule?.map
          ? `Score was not in the configured map for review ${index + 1}.`
          : `Score was not a number for review ${index + 1}.`,
      });
    }
    const reviewBody = readReviewBody(body);
    if (!reviewBody) {
      issues.push({
        field: "article.reviews",
        message: `Review ${index + 1} had no body text.`,
      });
    } else {
      externalReviewBodies[sourceKey] = reviewBody;
    }
    externalReviews.push({
      sourceKey,
      name,
      category: null,
      reviewerName,
      nativeScore:
        scoreRule && scoreValue !== null
          ? {
              value: scoreValue,
              scale: scoreRule.scale,
              display: scoreText ?? String(scoreValue),
            }
          : null,
    });
    if (rules.article.reviews.tastingNotes) {
      const value = readSavedReviewField(
        $,
        item,
        rules.article.reviews.tastingNotes,
        index,
      );
      if (value) externalReviewTexts[sourceKey] = value.slice(0, 50_000);
    }
  });

  const result = ExternalReviewArticleIngestionSchema.safeParse({
    article: {
      canonicalUrl: canonicalUrl?.toString() ?? null,
      title,
      issue: null,
      publishedAt,
      contentHash: createHash("sha256").update(html).digest("hex"),
      externalReviews,
    },
    externalReviewTexts,
    externalReviewBodies,
  });
  if (!result.success) {
    const reportedFields = new Set(issues.map(({ field }) => field));
    issues.push(
      ...validationIssues(result.error, savedReviewField).filter(
        ({ field }) =>
          ![...reportedFields].some(
            (reportedField) =>
              reportedField === field || reportedField.startsWith(`${field}.`),
          ),
      ),
    );
    return { kind: "review", value: null, issues };
  }
  return {
    kind: "review",
    value: issues.length === 0 ? result.data : null,
    issues,
  };
}

function parseSavedPriceDetail(
  rules: SavedPriceRules,
  html: string,
  pageUrl: URL,
): ScrapeDetailResult {
  const $ = load(html);
  let url = pageUrl.toString();
  if (rules.product.url) {
    const value = readPageField($, rules.product.url);
    if (value) url = sameWebsiteUrl(value, pageUrl);
  }
  const product = {
    name: readPageField($, rules.product.name),
    price: parsePriceInSmallestUnit(readPageField($, rules.product.price)),
    currency: rules.product.currency,
    volume: parseVolume(readPageField($, rules.product.volume)),
    url,
    externalProductId: rules.product.externalProductId
      ? (readPageField($, rules.product.externalProductId) ?? undefined)
      : undefined,
    imageUrl: rules.product.imageUrl
      ? (readPageField($, rules.product.imageUrl) ?? undefined)
      : undefined,
    barcode: rules.product.barcode
      ? (readPageField($, rules.product.barcode) ?? undefined)
      : undefined,
  };
  const result = StorePriceInputSchema.safeParse(product);
  if (!result.success) {
    return {
      kind: "price",
      value: [],
      issues: validationIssues(result.error, (path) =>
        path[0] ? `product.${String(path[0])}` : "product",
      ),
    };
  }
  return { kind: "price", value: [result.data], issues: [] };
}

function parseSavedCatalogDetail(
  rules: SavedCatalogRules,
  html: string,
  pageUrl: URL,
): ScrapeDetailResult {
  const $ = load(html);
  let url = pageUrl.toString();
  if (rules.product.url) {
    const value = readPageField($, rules.product.url);
    if (value) url = sameWebsiteUrl(value, pageUrl);
  }
  const readOptional = (field: StoredScrapePageField | null) =>
    field ? readPageField($, field) : null;
  const sourceBottleIdentity = {
    stated_age: parseNumber(readOptional(rules.product.statedAge)),
    abv: parseNumber(readOptional(rules.product.abv)),
    release_year: parseNumber(readOptional(rules.product.releaseYear)),
    edition: readOptional(rules.product.edition),
  };
  const listing = {
    name: readPageField($, rules.product.name),
    url,
    externalProductId:
      readOptional(rules.product.externalProductId) ?? undefined,
    imageUrl: readOptional(rules.product.imageUrl) ?? undefined,
    volume: parseVolume(readOptional(rules.product.volume)),
    sourceBottleIdentity: Object.values(sourceBottleIdentity).some(
      (value) => value !== null,
    )
      ? sourceBottleIdentity
      : undefined,
  };
  const result = CatalogListingInputSchema.safeParse(listing);
  if (!result.success) {
    return {
      kind: "catalog",
      value: [],
      issues: validationIssues(result.error, (path) =>
        path[0] === "sourceBottleIdentity" && path[1]
          ? `product.${String(path[1])}`
          : path[0]
            ? `product.${String(path[0])}`
            : "product",
      ),
    };
  }
  return { kind: "catalog", value: [result.data], issues: [] };
}

type PageValueKind = "text" | "date" | "url" | "image" | "id";

const PAGE_VALUE_ATTRIBUTES = {
  text: ["content", "value"],
  date: ["datetime", "content", "value"],
  url: ["href", "content", "src", "value"],
  image: ["src", "content", "href", "value"],
  id: ["value", "content", "data-product-id", "data-item-id"],
} as const satisfies Record<PageValueKind, readonly string[]>;

function readElement(
  selected: ReturnType<ReturnType<typeof load>>,
  kind: PageValueKind,
) {
  const attributeValue = PAGE_VALUE_ATTRIBUTES[kind]
    .map((attribute) => normalizeValue(selected.attr(attribute)))
    .find(Boolean);
  if (attributeValue) return attributeValue;
  if (kind === "id") {
    const id = normalizeValue(selected.attr("id"));
    if (id) return id.replace(/^product-/iu, "");
  }
  return normalizeValue(readText(selected));
}

function readSelectedValue(
  root: ReturnType<typeof load>,
  selector: string,
  kind: PageValueKind = "text",
  joinMatches = false,
) {
  const values: string[] = [];

  root(selector).each((_, element) => {
    const value = readElement(root(element), kind);
    if (!value) return;
    values.push(value);
    if (!joinMatches || values.length > 100) return false;
  });
  if (values.length > 100) {
    throw new Error("A selector matched more than 100 values.");
  }
  return normalizeValue(joinMatches ? values.join("\n") : values[0]);
}

function readArticleReviewValue(
  $: ReturnType<typeof load>,
  selector: string,
  reviewItems: NonNullable<ReturnType<typeof selectReviews>>,
) {
  const outsideReview = $(selector)
    .toArray()
    .filter(
      (element) =>
        !reviewItems.some(({ body }) =>
          [...body.toArray(), ...body.find("*").toArray()].includes(element),
        ),
    );
  return outsideReview.length === 1
    ? readElement($(outsideReview[0]!), "text")
    : null;
}

function reviewNameFromTitle(title: string) {
  return title.replace(/\s+(?:shelf\s+)?review$/iu, "").trim() || title;
}

function reviewerNameFromText(value: string | null) {
  return value?.replace(/^by\s+/iu, "").trim() || null;
}

function dateFromPageUrl(pageUrl: URL) {
  const createDate = (year: number, month: number, day: number) => {
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
      ? date
      : null;
  };
  const separated = pageUrl.pathname.match(
    /(?:^|\/)(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:\/|$)/u,
  );
  if (separated) {
    return createDate(
      Number(separated[1]),
      Number(separated[2]),
      Number(separated[3]),
    );
  }

  return readCompatiblePublishedDate(pageUrl);
}

// TODO(scraper-platform): Carry RSS and Atom item dates into detail parsing
// when an article omits its publication date.
function readPublishedDate(
  $: ReturnType<typeof load>,
  selector: string | null,
  pageUrl: URL,
) {
  if (selector) {
    return parseDate(readSelectedValue($, selector, "date"));
  }
  const selectors = [
    'meta[property="article:published_time"]',
    'meta[itemprop="datePublished"]',
    "time[datetime]",
  ];
  for (const candidate of selectors) {
    const value = readSelectedValue($, candidate, "date");
    const date = parseDate(value);
    if (date) return date;
  }
  const jsonLdDate = readJsonLdPublishedDate($);
  if (jsonLdDate) return jsonLdDate;
  return dateFromPageUrl(pageUrl);
}

function readJsonLdPublishedDate($: ReturnType<typeof load>) {
  for (const script of $('script[type="application/ld+json"]').toArray()) {
    let value: JsonLdValue;
    try {
      value = JsonLdValueSchema.parse(JSON.parse($(script).text()));
    } catch {
      continue;
    }

    const pending: JsonLdValue[] = [value];
    for (let index = 0; index < pending.length && index < 10_000; index += 1) {
      const current = pending[index];
      if (Array.isArray(current)) {
        pending.push(...current);
        continue;
      }

      const objectValue = JsonLdObjectSchema.safeParse(current);
      if (!objectValue.success) continue;
      const publishedDate = z
        .string()
        .safeParse(objectValue.data.datePublished);
      if (publishedDate.success) {
        const date = parseDate(publishedDate.data);
        if (date) return date;
      }
      pending.push(...Object.values(objectValue.data));
    }
  }
  return null;
}

function selectReviews(
  $: ReturnType<typeof load>,
  rules: Extract<ScrapeRules, { kind: "review" }>["detail"]["reviews"],
  nameSelector: string | null,
) {
  const areas = $(rules.area).toArray();
  if (areas.length !== 1) return null;
  const areaElement = areas[0]!;
  const area = $(areaElement);

  if (rules.item) {
    return area
      .find(rules.item)
      .toArray()
      .map((element) => ({
        body: $(element),
        item: load($.html(element)),
      }));
  }

  const starts = nameSelector ? area.find(nameSelector).toArray() : [];
  if (starts.length < 2) {
    return [{ body: area, item: load($.html(areaElement)) }];
  }

  const children = area.contents().toArray();
  const childIndexes = starts.map((element) => {
    const directChild = $(element)
      .parents()
      .toArray()
      .find((ancestor) => ancestor.parent === areaElement);
    return children.indexOf(directChild ?? element);
  });
  if (
    childIndexes.some(
      (index, position) => index < 0 || index === childIndexes[position - 1],
    )
  ) {
    throw new Error(
      "Each review name must start a separate part of the review area.",
    );
  }
  return starts.map((_, index) => {
    const bodyNodes = children.slice(
      childIndexes[index],
      childIndexes[index + 1] ?? children.length,
    );
    return {
      body: $(bodyNodes),
      item: load(bodyNodes.map((element) => $.html(element)).join("")),
    };
  });
}

function reviewRuleField(path: PropertyKey[]) {
  if (path[0] !== "article") return "detail";
  if (path[1] === "canonicalUrl") return "detail.url";
  if (path[1] === "title") return "detail.title";
  if (path[1] === "publishedAt") return "detail.date";
  if (path[1] !== "externalReviews") return "detail";
  if (path[3] === "name") return "detail.reviews.name";
  if (path[3] === "reviewerName") return "detail.reviews.reviewer";
  if (path[3] === "nativeScore") return "detail.reviews.score";
  return "detail.reviews";
}

function parseReviewPage(
  rules: Extract<ScrapeRules, { kind: "review" }>,
  html: string,
  pageUrl: URL,
): ScrapeDetailResult {
  const $ = load(html);
  const issues: ScrapeIssue[] = [];
  let canonicalUrl = pageUrl.toString();
  if (rules.detail.url) {
    const value = readSelectedValue($, rules.detail.url, "url");
    if (!value) {
      issues.push({
        field: "detail.url",
        message: "Required value was not found.",
      });
    } else {
      try {
        canonicalUrl = sameWebsiteUrl(value, pageUrl);
      } catch (error) {
        issues.push({
          field: "detail.url",
          message: error instanceof Error ? error.message : "URL is not valid.",
        });
      }
    }
  }
  const title = readSelectedValue($, rules.detail.title);
  const publishedAt = readPublishedDate(
    $,
    rules.detail.date,
    new URL(canonicalUrl),
  );
  if (!title) {
    issues.push({
      field: "detail.title",
      message: "Required value was not found.",
    });
  }
  if (!publishedAt) {
    issues.push({
      field: "detail.date",
      message: "Required date was not found or was not valid.",
    });
  }

  const externalReviews: Array<{
    sourceKey: string;
    name: string;
    category: null;
    reviewerName: string | null;
    nativeScore: { value: number; scale: number; display: string } | null;
  }> = [];
  const externalReviewTexts: Record<string, string> = {};
  const externalReviewBodies: Record<string, string> = {};
  const reviewKeys = new Set<string>();
  const { selector: nameSelector, match: nameMatch } =
    normalizeScrapeReviewNameRule(rules.detail.reviews.name);
  const reviewItems = selectReviews($, rules.detail.reviews, nameSelector);
  if (!reviewItems) {
    issues.push({
      field: "detail.reviews.area",
      message: "The review area must match exactly once.",
    });
  } else if (reviewItems.length === 0) {
    issues.push({
      field: "detail.reviews.item",
      message: "No reviews were found.",
    });
  }

  const reviewerSelector = rules.detail.reviews.reviewer;
  const sharedReviewerName =
    reviewItems && reviewerSelector
      ? readArticleReviewValue($, reviewerSelector, reviewItems)
      : null;
  const sharedReviewName =
    reviewItems?.length === 1 && nameSelector
      ? readArticleReviewValue($, nameSelector, reviewItems)
      : null;

  reviewItems?.forEach(({ body, item }, index) => {
    const selectedName = nameSelector
      ? (readSelectedValue(item, nameSelector) ?? sharedReviewName)
      : title;
    let name = selectedName;
    if (name && nameMatch) name = matchText(name, nameMatch);
    else if (name && !nameSelector) name = reviewNameFromTitle(name);
    if (!name) {
      issues.push({
        field: "detail.reviews.name",
        message: `Required value was not found for review ${index + 1}.`,
      });
      return;
    }
    const reviewerName = reviewerNameFromText(
      reviewerSelector
        ? (readSelectedValue(item, reviewerSelector) ?? sharedReviewerName)
        : null,
    );
    const sourceKey = reviewSourceKey(name, reviewerName);
    if (reviewKeys.has(sourceKey)) {
      issues.push({
        field: "detail.reviews.name",
        message:
          "Each review in an article must have a unique name and writer combination.",
      });
      return;
    }
    reviewKeys.add(sourceKey);
    const scoreRule = rules.detail.reviews.score;
    const scoreText = scoreRule
      ? (readSelectedValue(item, scoreRule.selector) ??
        (reviewItems.length === 1
          ? readSelectedValue($, scoreRule.selector)
          : null))
      : null;
    const scoreValue = parseScore(scoreText);
    if (scoreText && scoreValue === null) {
      issues.push({
        field: "detail.reviews.score",
        message: `Score was not a number for review ${index + 1}.`,
      });
    }
    const reviewBody = readReviewBody(body);
    if (!reviewBody) {
      issues.push({
        field: "detail.reviews.area",
        message: `Review ${index + 1} had no body text.`,
      });
    } else {
      externalReviewBodies[sourceKey] = reviewBody;
    }
    externalReviews.push({
      sourceKey,
      name,
      category: null,
      reviewerName,
      nativeScore:
        scoreRule && scoreValue !== null
          ? {
              value: scoreValue,
              scale: scoreRule.outOf,
              display: scoreText ?? String(scoreValue),
            }
          : null,
    });
    if (rules.detail.reviews.tastingNotes) {
      const value = readSelectedValue(
        item,
        rules.detail.reviews.tastingNotes,
        "text",
        true,
      );
      if (value) externalReviewTexts[sourceKey] = value.slice(0, 50_000);
    }
  });

  const result = ExternalReviewArticleIngestionSchema.safeParse({
    article: {
      canonicalUrl,
      title,
      issue: null,
      publishedAt,
      contentHash: createHash("sha256").update(html).digest("hex"),
      externalReviews,
    },
    externalReviewTexts,
    externalReviewBodies,
  });
  if (!result.success) {
    const reportedFields = new Set(issues.map(({ field }) => field));
    issues.push(
      ...validationIssues(result.error, reviewRuleField).filter(
        ({ field }) => !reportedFields.has(field),
      ),
    );
  }
  return {
    kind: "review",
    value: result.success && issues.length === 0 ? result.data : null,
    issues,
  };
}

function readProductUrl(
  $: ReturnType<typeof load>,
  selector: string | null,
  pageUrl: URL,
) {
  if (!selector) return pageUrl.toString();
  const value = readSelectedValue($, selector, "url");
  return value ? sameWebsiteUrl(value, pageUrl) : pageUrl.toString();
}

function cleanProductName(value: string | null) {
  return (
    value
      ?.replace(/\s+[–-]\s*[$£€]\s*\d[\d,.]*(?:\s*[A-Z]{3})?\s*$/u, "")
      .trim() || null
  );
}

function readImageUrl(
  $: ReturnType<typeof load>,
  selector: string | null,
  pageUrl: URL,
) {
  if (!selector) return undefined;
  const value = readSelectedValue($, selector, "image");
  if (!value) return undefined;
  const url = new URL(webUrl(value, pageUrl));
  if (pageUrl.protocol === "https:" && url.protocol === "http:") {
    url.protocol = "https:";
  }
  return url.toString();
}

function isFixedVolume(value: string | number | null): value is number {
  return Number.isInteger(value);
}

function productRuleField(path: PropertyKey[]) {
  if (path[0] === "externalProductId") return "detail.id";
  if (path[0] === "imageUrl") return "detail.image";
  if (path[0] === "sourceBottleIdentity") {
    if (path[1] === "stated_age") return "detail.age";
    if (path[1] === "release_year") return "detail.year";
    return path[1] ? `detail.${String(path[1])}` : "detail";
  }
  return path[0] ? `detail.${String(path[0])}` : "detail";
}

function parseProductPage(
  rules: Extract<ScrapeRules, { kind: "price" | "catalog" }>,
  html: string,
  pageUrl: URL,
): ScrapeDetailResult {
  const $ = load(html);
  const readOptional = (
    selector: string | null,
    kind: PageValueKind = "text",
    joinMatches = false,
  ) => (selector ? readSelectedValue($, selector, kind, joinMatches) : null);
  const volume = isFixedVolume(rules.detail.volume)
    ? rules.detail.volume
    : parseVolume(readOptional(rules.detail.volume, "text", true));
  const common = {
    name: cleanProductName(readSelectedValue($, rules.detail.name)),
    url: readProductUrl($, rules.detail.url, pageUrl),
    externalProductId: readOptional(rules.detail.id, "id") ?? undefined,
    imageUrl: readImageUrl($, rules.detail.image, pageUrl),
    volume,
  };

  if (rules.kind === "price") {
    const result = StorePriceInputSchema.safeParse({
      ...common,
      price: parseDisplayedPrice(
        readSelectedValue($, rules.detail.price, "text", true),
      ),
      currency: rules.detail.currency,
      barcode: readOptional(rules.detail.barcode, "id") ?? undefined,
    });
    return result.success
      ? { kind: "price", value: [result.data], issues: [] }
      : {
          kind: "price",
          value: [],
          issues: validationIssues(result.error, productRuleField),
        };
  }

  const sourceBottleIdentity = {
    stated_age: parseStatedAge(readOptional(rules.detail.age, "text", true)),
    abv: parseAbv(readOptional(rules.detail.abv, "text", true)),
    release_year: parseReleaseYear(
      readOptional(rules.detail.year, "text", true),
    ),
    edition: readOptional(rules.detail.edition),
  };
  const result = CatalogListingInputSchema.safeParse({
    ...common,
    sourceBottleIdentity: Object.values(sourceBottleIdentity).some(
      (value) => value !== null,
    )
      ? sourceBottleIdentity
      : undefined,
  });
  return result.success
    ? { kind: "catalog", value: [result.data], issues: [] }
    : {
        kind: "catalog",
        value: [],
        issues: validationIssues(result.error, productRuleField),
      };
}

function safelyParseScrapeDetail(
  rules: Pick<StoredScrapeRules, "kind">,
  field: "article" | "product" | "detail",
  parse: () => ScrapeDetailResult,
): ScrapeDetailResult {
  try {
    return parse();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to parse selector.";
    if (rules.kind === "review") {
      return {
        kind: "review",
        value: null,
        issues: [{ field, message }],
      };
    }
    if (rules.kind === "price") {
      return {
        kind: "price",
        value: [],
        issues: [{ field, message }],
      };
    }
    return {
      kind: "catalog",
      value: [],
      issues: [{ field, message }],
    };
  }
}

export function parseDirectScrapeDetail(
  rules: ScrapeRules,
  html: string,
  pageUrl: URL,
) {
  return safelyParseScrapeDetail(rules, "detail", () =>
    rules.kind === "review"
      ? parseReviewPage(rules, html, pageUrl)
      : parseProductPage(rules, html, pageUrl),
  );
}

export function parseSavedScrapeDetail(
  rules: SavedRules,
  html: string,
  pageUrl: URL,
  reviewKeys: "position" | "name-and-writer",
) {
  return safelyParseScrapeDetail(
    rules,
    rules.kind === "review" ? "article" : "product",
    () => {
      if (rules.kind === "review") {
        return parseSavedReviewDetail(
          rules,
          html,
          pageUrl,
          reviewKeys === "name-and-writer",
        );
      }
      return rules.kind === "price"
        ? parseSavedPriceDetail(rules, html, pageUrl)
        : parseSavedCatalogDetail(rules, html, pageUrl);
    },
  );
}

export function parseEarlyScrapeDetail(
  rules: EarlyRules,
  html: string,
  pageUrl: URL,
) {
  return safelyParseScrapeDetail(rules, "detail", () =>
    rules.kind === "review"
      ? parseReviewDetail(rules, html, pageUrl)
      : parseStorePriceDetail(rules, html, pageUrl),
  );
}

export function parseScrapeDetail(
  rules: ScrapeRules,
  html: string,
  pageUrl: URL,
): ScrapeDetailResult {
  return parseDirectScrapeDetail(rules, html, pageUrl);
}
