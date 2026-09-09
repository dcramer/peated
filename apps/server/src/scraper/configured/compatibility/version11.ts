import { ScrapeRulesV11Schema } from "../rules";
import type { StoredScrapeRulesInput } from "./contract";
import { interpretDirectRules } from "./interpreters";

export function decodeRulesVersion11(storedJson: StoredScrapeRulesInput) {
  const rules = ScrapeRulesV11Schema.parse(storedJson);
  return interpretDirectRules(rules, decodeRulesVersion11);
}
