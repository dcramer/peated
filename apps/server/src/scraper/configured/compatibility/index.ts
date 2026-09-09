import type { JsonValue } from "@peated/server/scraper/types";
import type { ScrapeRulesDecoder } from "./contract";
import { decodeRulesVersion1 } from "./version1";
import { decodeRulesVersion10 } from "./version10";
import { decodeRulesVersion11 } from "./version11";
import { decodeRulesVersion3 } from "./version3";
import { decodeRulesVersion6 } from "./version6";
import { decodeRulesVersion7 } from "./version7";
import { decodeRulesVersion8 } from "./version8";
import { decodeRulesVersion9 } from "./version9";

const DECODERS = new Map<number, ScrapeRulesDecoder>([
  [1, decodeRulesVersion1],
  [3, decodeRulesVersion3],
  [6, decodeRulesVersion6],
  [7, decodeRulesVersion7],
  [8, decodeRulesVersion8],
  [9, decodeRulesVersion9],
  [10, decodeRulesVersion10],
  [11, decodeRulesVersion11],
]);

/** Decodes saved JSON and binds it to the parsing behavior for that version. */
export function loadExecutableScrapeRules(
  rulesVersion: number,
  storedJson: JsonValue,
) {
  const decode = DECODERS.get(rulesVersion);
  if (!decode) {
    throw new Error(`Unsupported scrape rules version: ${rulesVersion}.`);
  }
  return decode(storedJson);
}

export type { ExecutableScrapeRules } from "./contract";
