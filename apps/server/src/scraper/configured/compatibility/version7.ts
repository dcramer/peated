import { ScrapeRulesV7Schema } from "../rules";
import type { StoredScrapeRulesInput } from "./contract";
import { interpretSavedRules } from "./interpreters";

export function decodeRulesVersion7(storedJson: StoredScrapeRulesInput) {
  const rules = ScrapeRulesV7Schema.parse(storedJson);
  return interpretSavedRules(rules, "position", decodeRulesVersion7);
}
