import { ScrapeRulesV6Schema } from "../rules";
import type { StoredScrapeRulesInput } from "./contract";
import { interpretSavedRules } from "./interpreters";

export function decodeRulesVersion6(storedJson: StoredScrapeRulesInput) {
  const rules = ScrapeRulesV6Schema.parse(storedJson);
  return interpretSavedRules(rules, "position", decodeRulesVersion6);
}
