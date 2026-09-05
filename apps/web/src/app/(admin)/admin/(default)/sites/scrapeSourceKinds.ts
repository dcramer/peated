export const SCRAPE_SOURCE_KIND_OPTIONS = [
  { label: "Reviews", value: "review" },
  { label: "Store prices", value: "price" },
  { label: "Official product catalog", value: "catalog" },
] as const;

export type ScrapeSourceKind =
  (typeof SCRAPE_SOURCE_KIND_OPTIONS)[number]["value"];

export function parseScrapeSourceKind(value: string): ScrapeSourceKind {
  const kind = SCRAPE_SOURCE_KIND_OPTIONS.find(
    (option) => option.value === value,
  )?.value;
  if (!kind) throw new Error("Unsupported content type.");
  return kind;
}
