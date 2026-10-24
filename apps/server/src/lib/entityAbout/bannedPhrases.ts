/**
 * Phrases About prose must not use. The `peated-writing` skill points here,
 * so writers and the About checks share one list. Match is case-insensitive
 * on whole words.
 */
export const ABOUT_BANNED_PHRASES = [
  // Trade jargon and marketing words from the Peated writing guide.
  "expression",
  "liquid",
  "organoleptic",
  "water of life",
  "curated",
  "discover",
  "journey",
  "unlock",
  "seamless",
  "experience",
  "community-driven",
  // Stock phrases that say nothing a source could support.
  "renowned",
  "iconic",
  "storied",
  "nestled",
  "rich history",
  "rich heritage",
  "testament",
  "boasts",
  "legacy",
  "in the heart of",
  "stands as",
  "continues to",
  "beloved",
  "world-class",
  "unparalleled",
  "second to none",
  "cult following",
  "must-try",
  "delve",
  "tapestry",
  "time-honored",
  "time-honoured",
] as const;

const BANNED_PATTERNS = ABOUT_BANNED_PHRASES.map((phrase) => ({
  phrase,
  pattern: new RegExp(
    `(?<![\\p{L}\\p{N}])${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`,
    "iu",
  ),
}));

/** Returns the banned phrases a text uses. */
export function findBannedPhrases(text: string) {
  return BANNED_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(
    ({ phrase }) => phrase,
  );
}
