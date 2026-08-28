import type { ExternalReviewArticleIngestion } from "@peated/server/externalReviews/observation";
import { ExternalReviewArticleIngestionSchema } from "@peated/server/externalReviews/observation";
import { StorePriceInputSchema } from "@peated/server/schemas";
import { load } from "cheerio";
import { createHash } from "node:crypto";
import type { z } from "zod";
import type {
  ConfiguredScraperConfig,
  ConfiguredValueSelector,
} from "./config";
import type { ConfiguredParseIssue } from "./validation";

export type { ConfiguredParseIssue } from "./validation";

export type ConfiguredIndexResult = {
  links: string[];
  issues: ConfiguredParseIssue[];
};

export type ConfiguredDetailResult =
  | {
      collection: "reviews";
      value: ExternalReviewArticleIngestion | null;
      issues: ConfiguredParseIssue[];
    }
  | {
      collection: "store_prices";
      value: z.infer<typeof StorePriceInputSchema>[];
      issues: ConfiguredParseIssue[];
    };

function messageForError(error: Error) {
  return error.message;
}

function readValue(
  root: ReturnType<typeof load>,
  selector: ConfiguredValueSelector,
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

export function parseConfiguredIndex(
  config: ConfiguredScraperConfig,
  html: string,
  pageUrl: URL,
): ConfiguredIndexResult {
  const issues: ConfiguredParseIssue[] = [];
  const links = new Set<string>();
  try {
    const $ = load(html);
    for (const element of $(config.index.itemLink.selector).toArray()) {
      const raw = config.index.itemLink.attribute
        ? $(element).attr(config.index.itemLink.attribute)
        : $(element).text();
      if (!raw?.trim()) continue;
      try {
        links.add(absoluteHttpUrl(raw.trim(), pageUrl));
      } catch (error) {
        issues.push({
          field: "index.itemLink",
          message: messageForError(
            error instanceof Error
              ? error
              : new Error("Unable to parse selector."),
          ),
        });
      }
      if (links.size >= config.index.maxItems) break;
    }
  } catch (error) {
    issues.push({
      field: "index.itemLink",
      message: messageForError(
        error instanceof Error ? error : new Error("Unable to parse selector."),
      ),
    });
  }
  if (links.size === 0) {
    issues.push({
      field: "index.itemLink",
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

function zodIssues(error: z.ZodError): ConfiguredParseIssue[] {
  return error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
}

function parseReviewDetail(
  config: Extract<ConfiguredScraperConfig, { collection: "reviews" }>,
  html: string,
  pageUrl: URL,
): ConfiguredDetailResult {
  const $ = load(html);
  const issues: ConfiguredParseIssue[] = [];
  const title = readValue($, config.detail.title);
  const publishedAtText = config.detail.publishedAt
    ? readValue($, config.detail.publishedAt)
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
    $(config.detail.reviewItem).each((index, element) => {
      const item = load($.html(element));
      const name = readValue(item, config.detail.name);
      if (!name) {
        issues.push({
          field: `detail.reviewItem.${index}.name`,
          message: "Required value was not found.",
        });
        return;
      }
      const sourceKey = `${pageUrl.toString()}#review-${index + 1}`;
      const reviewerName = config.detail.reviewerName
        ? readValue(item, config.detail.reviewerName)
        : null;
      const scoreText = config.detail.score
        ? readValue(item, config.detail.score.value)
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
          config.detail.score && scoreValue !== null
            ? {
                value: scoreValue,
                scale: config.detail.score.scale,
                display: scoreText ?? String(scoreValue),
              }
            : null,
      });
      if (config.detail.reviewText) {
        const text = readValue(item, config.detail.reviewText);
        if (text) externalReviewTexts[sourceKey] = text;
      }
    });
  } catch (error) {
    issues.push({
      field: "detail.reviewItem",
      message: messageForError(
        error instanceof Error ? error : new Error("Unable to parse selector."),
      ),
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
    issues.push(...zodIssues(result.error));
    return { collection: "reviews", value: null, issues };
  }
  return { collection: "reviews", value: result.data, issues };
}

function parseStorePriceDetail(
  config: Extract<ConfiguredScraperConfig, { collection: "store_prices" }>,
  html: string,
  pageUrl: URL,
): ConfiguredDetailResult {
  const $ = load(html);
  let url = pageUrl.toString();
  if (config.detail.url) {
    const value = readValue($, config.detail.url);
    if (value) url = absoluteHttpUrl(value, pageUrl);
  }
  const raw = {
    name: readValue($, config.detail.name),
    price: parsePriceInSmallestUnit(readValue($, config.detail.price)),
    currency: config.detail.currency,
    volume: parseVolume(readValue($, config.detail.volume)),
    url,
    externalProductId: config.detail.externalProductId
      ? (readValue($, config.detail.externalProductId) ?? undefined)
      : undefined,
    imageUrl: config.detail.imageUrl
      ? (readValue($, config.detail.imageUrl) ?? undefined)
      : undefined,
    barcode: config.detail.barcode
      ? (readValue($, config.detail.barcode) ?? undefined)
      : undefined,
  };
  const result = StorePriceInputSchema.safeParse(raw);
  if (!result.success) {
    return {
      collection: "store_prices",
      value: [],
      issues: zodIssues(result.error),
    };
  }
  return { collection: "store_prices", value: [result.data], issues: [] };
}

export function parseConfiguredDetail(
  config: ConfiguredScraperConfig,
  html: string,
  pageUrl: URL,
): ConfiguredDetailResult {
  try {
    return config.collection === "reviews"
      ? parseReviewDetail(config, html, pageUrl)
      : parseStorePriceDetail(config, html, pageUrl);
  } catch (error) {
    const message = messageForError(
      error instanceof Error ? error : new Error("Unable to parse selector."),
    );
    return config.collection === "reviews"
      ? {
          collection: "reviews",
          value: null,
          issues: [{ field: "detail", message }],
        }
      : {
          collection: "store_prices",
          value: [],
          issues: [{ field: "detail", message }],
        };
  }
}
