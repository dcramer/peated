import { ScrapeRulesV1Schema } from "../rules";
import type { StoredScrapeRulesInput } from "./contract";
import { interpretEarlyRules } from "./interpreters";

export function decodeRulesVersion1(storedJson: StoredScrapeRulesInput) {
  const rules = ScrapeRulesV1Schema.parse(storedJson);
  return interpretEarlyRules(rules, decodeRulesVersion1);
}
