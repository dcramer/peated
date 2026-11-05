import type { BottleExtractedDetails } from "./classifierTypes";

/** The typed Bottle fields that source facts can directly contradict. */
export const COMPARABLE_BOTTLE_FIELDS = [
  "category",
  "statedAge",
  "noAgeStatement",
  "abv",
  "vintageYear",
  "releaseYear",
  "caskStrength",
  "singleCask",
  "edition",
  "caskNumber",
  "bottlingYear",
  "releaseMonth",
  "releaseDay",
] as const;

export type ComparableBottleField = (typeof COMPARABLE_BOTTLE_FIELDS)[number];

export type ComparableBottleFields = {
  category?: string | null;
  statedAge?: number | null;
  noAgeStatement?: boolean | null;
  abv?: number | null;
  vintageYear?: number | null;
  releaseYear?: number | null;
  caskStrength?: boolean | null;
  singleCask?: boolean | null;
  edition?: string | null;
  caskNumber?: string | null;
  bottlingYear?: number | null;
  releaseMonth?: number | null;
  releaseDay?: number | null;
};

export type BottleFieldComparison = {
  agreements: ComparableBottleField[];
  missing: ComparableBottleField[];
  conflicts: ComparableBottleField[];
};

// Titles print `#3771` where the catalog stores `3771`; both name one cask.
// Other punctuation counts: `53.322` and `53322` are different casks.
function normalizeCaskNumber(value: string) {
  return value
    .replace(/^\s*#\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

// An edition marker is a word with a digit: a year, batch number, or code.
// Numbers joined by `.` or `/`, with any letters after them, stay one marker,
// so `1.1` is not `1.2` or `1`, and `1.2a` is not `1.2b`.
// `No.`, `#`, accents, and leading zeros do not change it.
function getEditionWords(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .match(/[a-z0-9]*\d(?:[./]\d[a-z0-9]*)+|[a-z0-9]+/g) ?? []
  );
}

// A space between letters and a number does not matter: `Batch3` reads as
// `Batch 3`. Each marker keeps its printed form and, when the other edition
// spells its leading letters as their own word, a form without them. Two
// markers match on their printed form, or when one was printed without
// letters and equals the other's form without them. So a printed code always
// matches itself, `Cask A 12` matches `A12`, and codes such as `A123` and
// `B123` still differ, even when each edition prints the other's letter.
function getEditionMarkers(words: string[], otherWords: string[]) {
  const dropLeadingZeros = (word: string) =>
    word.replace(/(^|[./])0+(?=\d)/g, "$1");
  return words
    .filter((word) => /\d/.test(word))
    .map((word) => {
      const [, letters, rest] = word.match(/^([a-z]+)(\d.*)$/) ?? [];
      return {
        printed: dropLeadingZeros(word),
        spaced: dropLeadingZeros(
          letters && rest && otherWords.includes(letters) ? rest : word,
        ),
      };
    });
}

type EditionMarker = ReturnType<typeof getEditionMarkers>[number];

function hasMarker(markers: EditionMarker[], marker: EditionMarker) {
  return markers.some(
    (other) =>
      other.printed === marker.printed ||
      (other.spaced === marker.spaced &&
        (other.spaced === other.printed || marker.spaced === marker.printed)),
  );
}

// Joins words where a letter meets a digit, so `S2 B13` and `S2B13` read the
// same. A space between two numbers still counts: `1 2` is not `12`.
function joinEditionWords(words: string[]) {
  return words.reduce(
    (text, word) =>
      /\d$/.test(text) && /^\d/.test(word) ? `${text} ${word}` : text + word,
    "",
  );
}

// Editions agree on the same markers and conflict only when each side has a
// marker the other lacks: `Batch 3` and `Batch 4` conflict, `2017 Release` and
// `2017 Edition` agree. Wording without markers is left to the classifier or
// the person comparing, so `First Edition` and `Limited Edition` neither agree
// nor conflict.
function compareEditions(left: string, right: string) {
  const leftWords = getEditionWords(left);
  const rightWords = getEditionWords(right);
  if (
    leftWords.some((word) => /\d/.test(word)) &&
    joinEditionWords(leftWords) === joinEditionWords(rightWords)
  )
    return "agreement";
  const leftMarkers = getEditionMarkers(leftWords, rightWords);
  const rightMarkers = getEditionMarkers(rightWords, leftWords);
  const leftOnly = leftMarkers.some((m) => !hasMarker(rightMarkers, m));
  const rightOnly = rightMarkers.some((m) => !hasMarker(leftMarkers, m));
  if (leftOnly && rightOnly) return "conflict";
  if (!leftOnly && !rightOnly && leftMarkers.length > 0) return "agreement";
  return null;
}

/**
 * Deterministic code rule (owner: Bottle classifier): the one comparison of
 * source facts with an existing Bottle, used by Bottle submission, candidate
 * order, the classifier, and automatic matching for every source. Code may
 * reject only a direct contradiction between two populated, typed fields.
 * Names, Brands, bottlers, and other free text are left to the classifier
 * because comparing them needs judgment. An empty field on either side never
 * conflicts.
 */
export function compareBottleFields(
  source: ComparableBottleFields,
  bottle: ComparableBottleFields,
): BottleFieldComparison {
  const result: BottleFieldComparison = {
    agreements: [],
    missing: [],
    conflicts: [],
  };
  for (const field of COMPARABLE_BOTTLE_FIELDS) {
    const expected = source[field];
    if (expected == null || expected === "") continue;
    const actual = bottle[field];
    if (actual == null || actual === "") {
      result.missing.push(field);
      continue;
    }
    const outcome =
      field === "edition"
        ? compareEditions(String(expected), String(actual))
        : field === "caskNumber"
          ? normalizeCaskNumber(String(expected)) ===
            normalizeCaskNumber(String(actual))
            ? "agreement"
            : "conflict"
          : expected === actual
            ? "agreement"
            : "conflict";
    if (outcome === "agreement") result.agreements.push(field);
    if (outcome === "conflict") result.conflicts.push(field);
  }
  return result;
}

/** Lists the typed fields where extracted source facts contradict a Bottle. */
export function getBottleFieldConflicts(
  facts: BottleExtractedDetails | null,
  bottle: ComparableBottleFields,
): ComparableBottleField[] {
  if (!facts) return [];

  return compareBottleFields(
    {
      category: facts.category,
      statedAge: facts.stated_age,
      abv: facts.abv,
      vintageYear: facts.vintage_year,
      releaseYear: facts.release_year,
      caskStrength: facts.cask_strength,
      singleCask: facts.single_cask,
      edition: facts.edition,
      caskNumber: facts.cask_number,
      bottlingYear: facts.bottling_year,
      releaseMonth: facts.release_month,
      releaseDay: facts.release_day,
    },
    bottle,
  ).conflicts;
}
