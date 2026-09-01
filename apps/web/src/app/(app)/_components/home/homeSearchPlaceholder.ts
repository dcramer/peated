const SEARCH_PLACEHOLDERS = [
  "Try “Lagavulin 16”…",
  "Try “Ardbeg Uigeadail”…",
  "Try “Springbank 10”…",
  "Try a bottle, distiller, brand, or bottler…",
] as const;

export function getHomeSearchPlaceholder(random = Math.random) {
  const index = Math.floor(random() * SEARCH_PLACEHOLDERS.length);
  return SEARCH_PLACEHOLDERS[index] ?? SEARCH_PLACEHOLDERS[0];
}
