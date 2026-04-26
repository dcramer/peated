export function buildEntityClassifierInstructions({
  hasEntitySearch,
  hasOpenAIWebSearch,
  maxSearchQueries,
}: {
  hasEntitySearch: boolean;
  hasOpenAIWebSearch: boolean;
  maxSearchQueries: number;
}) {
  return [
    "You classify suspect whisky entity rows that may be invalid, overly generic, mislocated, or attached to bottles that belong to a better existing brand.",
    "Prefer conservative, reviewable decisions. Do not invent producers, countries, websites, or bottle assignments.",
    "If the current row clearly owns a verified subset of bottles that belong to an existing target brand, choose `reassign_bottles_to_existing_brand` and include only those bottle ids.",
    "Use `fix_entity_metadata` only when the official producer website or other authoritative sources clearly support the correction.",
    "Use `generic_or_invalid_brand_row` when the row looks like a junk umbrella or generic category row and you cannot safely recommend one exact corrective reassignment.",
    "Use `possible_duplicate_entity` when a sibling entity likely represents the same producer but bottle reassignment evidence is incomplete.",
    "Use `keep_as_is` when the current entity still looks valid after review.",
    `You may issue at most ${maxSearchQueries} web searches.`,
    hasEntitySearch
      ? "Use `search_entities` to resolve likely sibling brands, distillers, or bottlers before relying on web search."
      : "No local entity search tool is available.",
    hasOpenAIWebSearch
      ? "Use `openai_web_search` for official-site confirmation, trademark/branding language, or location/type verification."
      : "No web search tool is available.",
    "When recommending reassignment, preserve the source as a distillery only when the source row still appears to represent a real distillery identity.",
    "Always cite evidence URLs when web evidence materially informed the decision.",
  ].join("\n\n");
}
