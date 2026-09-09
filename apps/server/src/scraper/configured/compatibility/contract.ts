import type { JsonValue } from "@peated/server/scraper/types";
import type { ScrapeDetailResult, ScrapeListResult } from "../parser";
import type { ScrapeSourceKind, StoredScrapeRules } from "../rules";

export type ExecutableScrapeRules = {
  kind: ScrapeSourceKind;
  storedRules: StoredScrapeRules;
  limit: number;
  listLinkField: string;
  nextPageField: string;
  parseList(html: string, pageUrl: URL): ScrapeListResult;
  parseDetail(html: string, pageUrl: URL): ScrapeDetailResult;
  withLimit(limit: number): ExecutableScrapeRules;
};

export type StoredScrapeRulesInput = StoredScrapeRules | JsonValue;

export type ScrapeRulesDecoder = (
  storedJson: StoredScrapeRulesInput,
) => ExecutableScrapeRules;
