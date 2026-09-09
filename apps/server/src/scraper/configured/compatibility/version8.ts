import { ScrapeRulesV8Schema } from "../rules";
import type { StoredScrapeRulesInput } from "./contract";
import { interpretSavedRules } from "./interpreters";

export function decodeRulesVersion8(storedJson: StoredScrapeRulesInput) {
  const rules = ScrapeRulesV8Schema.parse(storedJson);
  return interpretSavedRules(rules, "name-and-writer", decodeRulesVersion8);
}
