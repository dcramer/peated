import { ScrapeRulesV10Schema } from "../rules";
import type { StoredScrapeRulesInput } from "./contract";
import { interpretDirectRules } from "./interpreters";

export function decodeRulesVersion10(storedJson: StoredScrapeRulesInput) {
  const rules = ScrapeRulesV10Schema.parse(storedJson);
  return interpretDirectRules(rules, decodeRulesVersion10);
}
