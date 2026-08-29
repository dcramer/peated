import type { ExternalReviewArticleIngestion } from "@peated/server/externalReviews/observation";
import { ExternalReviewArticleIngestionSchema } from "@peated/server/externalReviews/observation";
import { StorePriceInputSchema } from "@peated/server/schemas";
import { load } from "cheerio";
import { createHash } from "node:crypto";
import type { z } from "zod";
import type { ScrapeIssue } from "./preview";
import type { ScrapeRules, ScrapeValueSelector } from "./rules";

export type { ScrapeIssue } from "./preview";

export type ScrapeListResult = {
  links: string[];
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

function readValue(
  root: ReturnType<typeof load>,
  selector: ScrapeValueSelector,
) {
  const element = root(selector.selector).first();
  const raw = selector.attribute
    ? element.attr(selector.attribute)
    : element.text();
  const value = raw?.replaceAll(/\s+/g, " ").trim();
  return value || null;
}

function absoluteHttpUrl(value: string, baseUrl: URL) {
  const url = new URL(value, baseUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("URL must use HTTP or HTTPS.");
  }
  if (url.origin !== baseUrl.origin) {
    throw new Error("Detail pages must use the same website as the list page.");
  }
  url.hash = "";
  return url.toString();
}

export function parseScrapeList(
  rules: ScrapeRules,
  html: string,
  pageUrl: URL,
): ScrapeListResult {
  const issues: ScrapeIssue[] = [];
  const links = new Set<string>();
  try {
    const $ = load(html);
    for (const element of $(rules.list.detailLink.selector).toArray()) {
      const raw = rules.list.detailLink.attribute
        ? $(element).attr(rules.list.detailLink.attribute)
        : $(element).text();
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
  return { links: [...links], issues };
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
  return normalized.includes("cl")
    ? Math.round(number * 10)
    : Math.round(number);
}

function validationIssues(error: z.ZodError): ScrapeIssue[] {
  return error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
}

function parseReviewDetail(
  rules: Extract<ScrapeRules, { kind: "review" }>,
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
  if (publishedAtText && !publishedAt) {
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

  try {
    $(rules.detail.reviewItem).each((index, element) => {
      const item = load($.html(element));
      const name = readValue(item, rules.detail.name);
      if (!name) {
        issues.push({
          field: `detail.reviewItem.${index}.name`,
          message: "Required value was not found.",
        });
        return;
      }
      const sourceKey = `${pageUrl.toString()}#review-${index + 1}`;
      const reviewerName = rules.detail.reviewerName
        ? readValue(item, rules.detail.reviewerName)
        : null;
      const scoreText = rules.detail.score
        ? readValue(item, rules.detail.score.value)
        : null;
      const scoreValue = parseNumber(scoreText);
      if (scoreText && scoreValue === null) {
        issues.push({
          field: `detail.reviewItem.${index}.score`,
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
        const text = readValue(item, rules.detail.reviewText);
        if (text) externalReviewTexts[sourceKey] = text;
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
  });
  if (!result.success) {
    issues.push(...validationIssues(result.error));
    return { kind: "review", value: null, issues };
  }
  return { kind: "review", value: result.data, issues };
}

function parseStorePriceDetail(
  rules: Extract<ScrapeRules, { kind: "price" }>,
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
      issues: validationIssues(result.error),
    };
  }
  return { kind: "price", value: [result.data], issues: [] };
}

export function parseScrapeDetail(
  rules: ScrapeRules,
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
