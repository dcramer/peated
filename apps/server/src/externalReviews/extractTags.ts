import type { Tag } from "@peated/server/db/schema/tags";

function tokenize(text: string): string[] {
  return (
    text
      .normalize("NFKC")
      .toLowerCase()
      .replaceAll(/[-‐‑]/gu, " ")
      .replaceAll(/\r?\n/gu, ".")
      .match(/[\p{L}\p{N}]+|[^\s]/gu) ?? []
  );
}

/**
 * Matches known tasting words once per review. External reviews own this
 * best-effort matcher; a missing match does not mean a flavor is absent.
 */
export function extractReviewTags(
  text: string,
  vocabulary: Pick<Tag, "name" | "synonyms">[],
): string[] {
  const phrases = new Map<string, string | null>();
  for (const tag of vocabulary) {
    for (const synonym of tag.synonyms) {
      const phrase = tokenize(synonym).join(" ");
      if (!phrase) continue;
      // External reviews skip synonyms shared by different tags.
      phrases.set(
        phrase,
        phrases.has(phrase) && phrases.get(phrase) !== tag.name
          ? null
          : tag.name,
      );
    }
  }
  for (const tag of vocabulary) {
    phrases.set(tokenize(tag.name).join(" "), tag.name);
  }
  const patterns = [...phrases].flatMap(([phrase, name]) =>
    name && phrase ? [{ words: phrase.split(" "), name }] : [],
  );
  patterns.sort((left, right) => right.words.length - left.words.length);

  const tokens = tokenize(text);
  const found = new Set<string>();
  let negated = false;
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (
      /^[.,;:!?()]$/u.test(token) ||
      /^(but|yet|however|though)$/u.test(token)
    ) {
      negated = false;
    } else if (/^(no|not|without|neither|nor|lacks|lacking)$/u.test(token)) {
      const exception =
        (token === "not" && /^(only|just)$/u.test(tokens[index + 1] ?? "")) ||
        (token === "no" && /^(shortage|lack)$/u.test(tokens[index + 1] ?? ""));
      if (!exception) negated = true;
    }
    const pattern = patterns.find(({ words }) =>
      words.every((word, offset) => tokens[index + offset] === word),
    );
    if (!pattern) continue;
    if (!negated && tokens[index + pattern.words.length] !== "free") {
      found.add(pattern.name);
    }
    // Skip the whole phrase even after "no", so "no dark chocolate" cannot add "chocolate".
    index += pattern.words.length - 1;
  }
  return [...found].sort();
}
