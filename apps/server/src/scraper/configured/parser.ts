import type { ExternalReviewArticleIngestion } from "@peated/server/externalReviews/observation";
import { ExternalReviewArticleIngestionSchema } from "@peated/server/externalReviews/observation";
import { StorePriceInputSchema } from "@peated/server/schemas";
import { load } from "cheerio";
import { createHash } from "node:crypto";
import type { z } from "zod";
import { readReviewBody } from "../adapters/reviewBody";
import type { ScrapeIssue } from "./preview";
import type {
  ScrapePageField,
  ScrapePageRead,
  ScrapeReviewField,
  ScrapeRules,
  ScrapeValue,
  ScrapeValueSelectorV1,
  StoredScrapeRules,
} from "./rules";
import { ScrapeReviewSectionSchema, ScrapeSelectorSchema } from "./rules";

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
type ReviewRulesV6 = Extract<ScrapeRules, { kind: "review" }>;
type PriceRulesV6 = Extract<ScrapeRules, { kind: "price" }>;
type LegacyReviewRules = Exclude<
  Extract<StoredScrapeRules, { kind: "review" }>,
  ReviewRulesV6
>;
type LegacyPriceRules = Exclude<
  Extract<StoredScrapeRules, { kind: "price" }>,
  PriceRulesV6
>;

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

function cleanPageValue(value: string | null, clean: ScrapePageRead["clean"]) {
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

function readPageValue(root: ReturnType<typeof load>, rule: ScrapePageRead) {
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

function readPageField(root: ReturnType<typeof load>, field: ScrapePageField) {
  for (const rule of field.try) {
    const value = readPageValue(root, rule);
    if (value) return value;
  }
  return null;
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
  if ("articles" in rules || "products" in rules) {
    return parseListV6(rules, html, pageUrl);
  }
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

function parseListV6(
  rules: ScrapeRules,
  html: string,
  pageUrl: URL,
): ScrapeListResult {
  const $ = load(html);
  const issues: ScrapeIssue[] = [];
  const links = new Set<string>();
  const list = rules.kind === "review" ? rules.articles : rules.products;
  const itemSelector =
    rules.kind === "review"
      ? rules.articles.oneArticlePer
      : rules.products.oneProductPer;
  const fieldRoot = rules.kind === "review" ? "articles" : "products";
  try {
    for (const itemElement of $(itemSelector).toArray()) {
      const item = load($.html(itemElement));
      if (list.skipWhen) {
        const matches = item(list.skipWhen.selector).toArray();
        const startsWith = list.skipWhen.startsWith?.map((value) =>
          value.toLocaleLowerCase("en"),
        );
        const shouldSkip = matches.some((element) => {
          if (!startsWith) return true;
          const text = normalizeValue(item(element).text())?.toLocaleLowerCase(
            "en",
          );
          return Boolean(
            text && startsWith.some((prefix) => text.startsWith(prefix)),
          );
        });
        if (shouldSkip) continue;
      }
      const itemLinks = item(list.link).toArray();
      for (const element of itemLinks) {
        const raw = item(element).attr("href");
        if (!raw?.trim()) continue;
        try {
          links.add(absoluteHttpUrl(raw.trim(), pageUrl));
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
  if (links.size === 0) {
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
        nextPageUrl = absoluteHttpUrl(raw, pageUrl);
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
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

function parseDateFromUrl(url: URL, format: string) {
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

  const match = new RegExp(pattern, "u").exec(url.pathname);
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
  const section = ScrapeReviewSectionSchema.safeParse(rule);
  if (!section.success) {
    return $(ScrapeSelectorSchema.parse(rule))
      .toArray()
      .map((element) => ({
        body: $(element),
        item: load($.html(element)),
      }));
  }

  const starts = $(section.data.start).toArray();
  return starts.map((start) => {
    if (starts.length === 1) {
      const parent = $(start).parent();
      if (!section.data.endBefore) {
        return {
          body: parent,
          item: load(parent.html() ?? ""),
        };
      }
      const body = $($(start).prevAll().toArray().reverse())
        .add(start)
        .add($(start).nextUntil(section.data.endBefore));
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

    const stopSelector = [section.data.start, section.data.endBefore]
      .filter(Boolean)
      .join(", ");
    const body = $(start).add($(start).nextUntil(stopSelector));
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
        canonicalUrl = new URL(absoluteHttpUrl(canonicalUrlText, pageUrl));
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
      const firstReviewFallback =
        scoreRule &&
        "firstReviewFallback" in scoreRule &&
        scoreRule.firstReviewFallback;
      const scoreText = scoreRule
        ? (readValue(item, scoreRule.value) ??
          (index === 0 && firstReviewFallback
            ? readValue($, firstReviewFallback)
            : reviewItems.length === 1
              ? readValue($, scoreRule.value)
              : null))
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

function reviewFieldV6(path: PropertyKey[]) {
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

function readReviewFieldV6(
  page: ReturnType<typeof load>,
  review: ReturnType<typeof load>,
  field: ScrapeReviewField,
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

function selectReviewItemsV6(
  $: ReturnType<typeof load>,
  rules: ReviewRulesV6["article"]["reviews"],
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
      .toArray()
      .map((element) => ({
        body: $(element),
        item: load($.html(element)),
      }));
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

function readPublishedDate(
  $: ReturnType<typeof load>,
  field: ReviewRulesV6["article"]["publishedDate"],
  pageUrl: URL,
) {
  for (const rule of field.try) {
    if (rule.get === "dateFromUrl") {
      const date = parseDateFromUrl(pageUrl, rule.format);
      if (date) return date;
      continue;
    }
    const value = readPageValue($, rule);
    if (!value) continue;
    return parseDate(value);
  }
  return null;
}

function parseReviewDetailV6(
  rules: ReviewRulesV6,
  html: string,
  pageUrl: URL,
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
        canonicalUrl = new URL(absoluteHttpUrl(value, pageUrl));
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
  const publishedAt = readPublishedDate(
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
  const reviewItems = selectReviewItemsV6($, rules.article.reviews);
  if (!reviewItems) {
    issues.push({
      field: "article.reviews.inside",
      message: "The review area must match exactly once.",
    });
  } else if (reviewItems.length === 0) {
    issues.push({
      field: "article.reviews.selector",
      message: "No reviews were found.",
    });
  }

  reviewItems?.forEach(({ body, item }, index) => {
    const name = readReviewFieldV6($, item, rules.article.reviews.name, index);
    if (!name) {
      issues.push({
        field: "article.reviews.name",
        message: `Required value was not found for review ${index + 1}.`,
      });
      return;
    }
    const sourceKey = `${canonicalUrl?.toString() ?? pageUrl.toString()}#review-${index + 1}`;
    const reviewerName = rules.article.reviews.reviewer
      ? readReviewFieldV6($, item, rules.article.reviews.reviewer, index)
      : null;
    const scoreRule = rules.article.reviews.score;
    const scoreText = scoreRule
      ? readReviewFieldV6($, item, scoreRule, index)
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
      const value = readReviewFieldV6(
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
      ...validationIssues(result.error, reviewFieldV6).filter(
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

function parsePriceDetailV6(
  rules: PriceRulesV6,
  html: string,
  pageUrl: URL,
): ScrapeDetailResult {
  const $ = load(html);
  let url = pageUrl.toString();
  if (rules.product.url) {
    const value = readPageField($, rules.product.url);
    if (value) url = absoluteHttpUrl(value, pageUrl);
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

export function parseScrapeDetail(
  rules: StoredScrapeRules,
  html: string,
  pageUrl: URL,
): ScrapeDetailResult {
  try {
    if (rules.kind === "review" && "article" in rules) {
      return parseReviewDetailV6(rules, html, pageUrl);
    }
    if (rules.kind === "price" && "product" in rules) {
      return parsePriceDetailV6(rules, html, pageUrl);
    }
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
          issues: [
            {
              field: "article" in rules ? "article" : "detail",
              message,
            },
          ],
        }
      : {
          kind: "price",
          value: [],
          issues: [
            {
              field: "product" in rules ? "product" : "detail",
              message,
            },
          ],
        };
  }
}
