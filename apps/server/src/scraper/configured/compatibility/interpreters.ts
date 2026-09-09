import {
  parseDirectScrapeDetail,
  parseDirectScrapeList,
  parseEarlyScrapeDetail,
  parseEarlyScrapeList,
  parseSavedScrapeDetail,
  parseSavedScrapeList,
  type ScrapeDetailResult,
  type ScrapeListResult,
} from "../parser";
import type { ScrapeRules, StoredScrapeRules } from "../rules";
import type { ExecutableScrapeRules, ScrapeRulesDecoder } from "./contract";

type EarlyRules = Extract<StoredScrapeRules, { list: { detailLink: unknown } }>;
type SavedRules = Extract<
  StoredScrapeRules,
  { articles: unknown } | { products: unknown }
>;

function contract<T extends StoredScrapeRules>(input: {
  rules: T;
  limit: number;
  listLinkField: string;
  nextPageField: string;
  parseList(html: string, pageUrl: URL): ScrapeListResult;
  parseDetail(html: string, pageUrl: URL): ScrapeDetailResult;
  withLimit(limit: number): ExecutableScrapeRules;
}): ExecutableScrapeRules {
  return {
    kind: input.rules.kind,
    storedRules: input.rules,
    limit: input.limit,
    listLinkField: input.listLinkField,
    nextPageField: input.nextPageField,
    parseList: (html, pageUrl) => input.parseList(html, pageUrl),
    parseDetail: (html, pageUrl) => input.parseDetail(html, pageUrl),
    withLimit: (limit) => input.withLimit(limit),
  };
}

export function interpretEarlyRules(
  rules: EarlyRules,
  decode: ScrapeRulesDecoder,
) {
  return contract({
    rules,
    limit: rules.list.maxItems,
    listLinkField: "list.detailLink",
    nextPageField: "list.nextPage",
    parseList: (html, pageUrl) => parseEarlyScrapeList(rules, html, pageUrl),
    parseDetail: (html, pageUrl) =>
      parseEarlyScrapeDetail(rules, html, pageUrl),
    withLimit: (requestedLimit) =>
      decode({
        ...rules,
        list: {
          ...rules.list,
          maxItems: Math.min(rules.list.maxItems, requestedLimit),
        },
      }),
  });
}

export function interpretSavedRules(
  rules: SavedRules,
  reviewKeys: "position" | "name-and-writer",
  decode: ScrapeRulesDecoder,
) {
  const list = rules.kind === "review" ? rules.articles : rules.products;
  const fieldRoot = rules.kind === "review" ? "articles" : "products";
  return contract({
    rules,
    limit: list.limit,
    listLinkField: `${fieldRoot}.link`,
    nextPageField: `${fieldRoot}.nextPage`,
    parseList: (html, pageUrl) => parseSavedScrapeList(rules, html, pageUrl),
    parseDetail: (html, pageUrl) =>
      parseSavedScrapeDetail(rules, html, pageUrl, reviewKeys),
    withLimit: (requestedLimit) => {
      const limit = Math.min(list.limit, requestedLimit);
      return rules.kind === "review"
        ? decode({
            ...rules,
            articles: { ...rules.articles, limit },
          })
        : decode({
            ...rules,
            products: { ...rules.products, limit },
          });
    },
  });
}

export function interpretDirectRules(
  rules: ScrapeRules,
  decode: ScrapeRulesDecoder,
) {
  return contract({
    rules,
    limit: rules.list.limit,
    listLinkField: "list.links",
    nextPageField: "list.nextPage",
    parseList: (html, pageUrl) => parseDirectScrapeList(rules, html, pageUrl),
    parseDetail: (html, pageUrl) =>
      parseDirectScrapeDetail(rules, html, pageUrl),
    withLimit: (requestedLimit) =>
      decode({
        ...rules,
        list: {
          ...rules.list,
          limit: Math.min(rules.list.limit, requestedLimit),
        },
      }),
  });
}
