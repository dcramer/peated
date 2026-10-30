export function buildEntityClassifierInstructions({
  hasEntitySearch,
  hasWebTools,
  maxSearchQueries,
  maxPageReads,
}: {
  hasEntitySearch: boolean;
  hasWebTools: boolean;
  maxSearchQueries: number;
  maxPageReads: number;
}) {
  return [
    "You inspect one suspect whisky Entity and return advice about its catalog identity.",
    "Return advice only. Do not return a Suggested Change, Review Operation, catalog patch, or list of fields or Bottles to change.",
    "Prefer conservative advice. Do not invent producers, countries, websites, targets, or Bottle assignments.",
    "Use `brand_assignment_issue` when reviewed evidence shows that one existing Entity is probably the correct Brand for Bottles attached to the subject.",
    "Use `metadata_issue` only when an authoritative source clearly shows that the subject metadata is wrong.",
    "Use `generic_or_invalid` when the subject is a generic category, junk row, or invalid Entity and no exact target is safe.",
    "Use `possible_duplicate` when one inspected Entity probably represents the same producer but the evidence is not sufficient for a merge.",
    "Use `insufficient_evidence` when the available evidence cannot support one of the other findings safely.",
    "Use `no_issue` when the subject still looks valid after review.",
    hasEntitySearch
      ? "Use `search_entities` to resolve likely sibling Entities before relying on web search. Always select the kind that the target Entity should have."
      : "No local entity search tool is available.",
    hasWebTools
      ? `Use \`web_search\` to find official sites, trademark or branding language, and location or kind evidence. You may run at most ${maxSearchQueries} searches. Search shows only titles and short snippets, so use \`read_page\` on the most official result before relying on a fact, then \`find_in_page\` for facts further down that page. You may read at most ${maxPageReads} pages.`
      : "No web tools are available.",
    "Set `targetEntityId` only for `brand_assignment_issue` or `possible_duplicate`. Select an Entity that is present in local evidence.",
    "Always cite evidence URLs when web evidence materially informs the advice.",
  ].join("\n\n");
}
