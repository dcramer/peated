import { ScrapeRulesV3Schema } from "../rules";
import type { StoredScrapeRulesInput } from "./contract";
import { interpretEarlyRules } from "./interpreters";

export function decodeRulesVersion3(storedJson: StoredScrapeRulesInput) {
  const rules = ScrapeRulesV3Schema.parse(storedJson);
  return interpretEarlyRules(rules, decodeRulesVersion3);
}
