const PASSAGE_CHARS = 300;
const MAX_PASSAGES = 3;

/**
 * Passages around each match of `query` in the page, ignoring case. Each
 * passage is centred on its match and passages never overlap.
 */
export function findPagePassages(text: string, query: string) {
  const haystack = text.toLowerCase();
  const needle = query.trim().toLowerCase();
  const passages: string[] = [];
  let from = 0;
  while (passages.length < MAX_PASSAGES) {
    const index = haystack.indexOf(needle, from);
    if (index < 0) break;
    const start = Math.max(
      0,
      index - Math.floor((PASSAGE_CHARS - needle.length) / 2),
    );
    const end = Math.min(text.length, start + PASSAGE_CHARS);
    passages.push(text.slice(start, end).replace(/\s+/g, " ").trim());
    from = end;
  }
  return passages;
}
