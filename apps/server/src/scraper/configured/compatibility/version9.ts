import { ScrapeRulesV9Schema } from "../rules";
import type { StoredScrapeRulesInput } from "./contract";
import { interpretSavedRules } from "./interpreters";

export function decodeRulesVersion9(storedJson: StoredScrapeRulesInput) {
  const rules = ScrapeRulesV9Schema.parse(storedJson);
  return interpretSavedRules(rules, "name-and-writer", decodeRulesVersion9);
}
