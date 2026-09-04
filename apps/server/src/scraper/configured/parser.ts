import type { ExternalReviewArticleIngestion } from "@peated/server/externalReviews/observation";
import { ExternalReviewArticleIngestionSchema } from "@peated/server/externalReviews/observation";
import { StorePriceInputSchema } from "@peated/server/schemas";
import { load } from "cheerio";
import { createHash } from "node:crypto";
import type { z } from "zod";
import { readReviewBody } from "../adapters/reviewBody";
import type { ScrapeIssue } from "./preview";
import type {
  ScrapeValue,
  ScrapeValueSelectorV1,
  StoredScrapeRules,
} from "./rules";

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
    };

type ScrapeReadableValue = ScrapeValue | ScrapeValueSelectorV1;

function normalizeValue(value: string | undefined) {
  return value?.replaceAll(/\s+/g, " ").trim() || null;
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
    const value = normalizeValue(root(element).text());
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

function absoluteHttpUrl(value: string, baseUrl: URL) {
  const url = new URL(value, baseUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("URL must use HTTP or HTTPS.");
  }
  if (url.origin !== baseUrl.origin) {
    throw new Error("Pages must stay on the source website.");
  }
  url.hash = "";
  return url.toString();
}

export function parseScrapeList(
  rules: StoredScrapeRules,
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
          links.add(absoluteHttpUrl(raw.trim(), pageUrl));
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
        nextPageUrl = absoluteHttpUrl(raw, pageUrl);
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

function parseDate(value: string | null) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

function parseNumber(value: string | null) {
  if (!value) return null;
  const match = value.replaceAll(",", "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
}

function parsePriceInSmallestUnit(value: string | null) {
  const number = parseNumber(value);
  if (number === null || number <= 0) return null;
  return Math.round(number * 100);
}

function parseVolume(value: string | null) {
  if (!value) return null;
  const normalized = value.toLowerCase().replaceAll(",", "");
  const number = parseNumber(normalized);
  if (number === null || number <= 0) return null;
  if (normalized.includes("cl")) return Math.round(number * 10);
  if (/(?:^|[^a-z])l(?:[^a-z]|$)/.test(normalized)) {
    return Math.round(number * 1000);
  }
  return Math.round(number);
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

function parseReviewDetail(
  rules: Extract<StoredScrapeRules, { kind: "review" }>,
  html: string,
  pageUrl: URL,
): ScrapeDetailResult {
  const $ = load(html);
  const issues: ScrapeIssue[] = [];
  const title = readValue($, rules.detail.title);
  const publishedAtText = rules.detail.publishedAt
    ? readValue($, rules.detail.publishedAt)
    : null;
  const publishedAt = parseDate(publishedAtText);
  if (!publishedAtText) {
    issues.push({
      field: "detail.publishedAt",
      message: "Required value was not found.",
    });
  } else if (!publishedAt) {
    issues.push({ field: "detail.publishedAt", message: "Date is not valid." });
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
  const reviewItems = $(rules.detail.reviewItem).toArray();
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
              $(element).closest(rules.detail.reviewItem).length === 0,
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
    reviewItems.forEach((element, index) => {
      const item = load($.html(element));
      const name = readReviewValue(item, rules.detail.name);
      if (!name) {
        issues.push({
          field: "detail.name",
          message: "Required value was not found.",
        });
        return;
      }
      const sourceKey = `${pageUrl.toString()}#review-${index + 1}`;
      const body = readReviewBody($(element));
      if (body) externalReviewBodies[sourceKey] = body;
      const reviewerName = reviewerSelector
        ? (readValue(item, reviewerSelector) ?? pageReviewerName)
        : null;
      const scoreText = rules.detail.score
        ? readReviewValue(item, rules.detail.score.value)
        : null;
      const scoreValue = parseNumber(scoreText);
      if (scoreText && scoreValue === null) {
        issues.push({
          field: "detail.score",
          message: "Score is not a number.",
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
      canonicalUrl: pageUrl.toString(),
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
        ({ field }) => field !== "detail.publishedAt",
      ),
    );
    return { kind: "review", value: null, issues };
  }
  return { kind: "review", value: result.data, issues };
}

function parseStorePriceDetail(
  rules: Extract<StoredScrapeRules, { kind: "price" }>,
  html: string,
  pageUrl: URL,
): ScrapeDetailResult {
  const $ = load(html);
  let url = pageUrl.toString();
  if (rules.detail.url) {
    const value = readValue($, rules.detail.url);
    if (value) url = absoluteHttpUrl(value, pageUrl);
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

export function parseScrapeDetail(
  rules: StoredScrapeRules,
  html: string,
  pageUrl: URL,
): ScrapeDetailResult {
  try {
    return rules.kind === "review"
      ? parseReviewDetail(rules, html, pageUrl)
      : parseStorePriceDetail(rules, html, pageUrl);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to parse selector.";
    return rules.kind === "review"
      ? {
          kind: "review",
          value: null,
          issues: [{ field: "detail", message }],
        }
      : {
          kind: "price",
          value: [],
          issues: [{ field: "detail", message }],
        };
  }
}
