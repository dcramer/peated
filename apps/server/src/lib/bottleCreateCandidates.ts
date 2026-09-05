import type { Bottle } from "@peated/server/types";

type IdentityChoice = {
  id?: number | null;
  name: string;
};

type BottleCreateCandidateFacts = Pick<
  Bottle,
  | "abv"
  | "bottlingYear"
  | "caskNumber"
  | "caskStrength"
  | "category"
  | "description"
  | "descriptionSrc"
  | "edition"
  | "flavorProfile"
  | "maltPhenolPpm"
  | "maturation"
  | "naturalColor"
  | "noAgeStatement"
  | "nonChillFiltered"
  | "outturn"
  | "releaseDay"
  | "releaseMonth"
  | "releaseYear"
  | "singleCask"
  | "statedAge"
  | "tastingNotes"
  | "vintageYear"
>;

export type BottleCreateCandidateInput = Partial<BottleCreateCandidateFacts> & {
  name: string;
  brand?: IdentityChoice | null;
  distillers?: readonly IdentityChoice[];
  bottler?: IdentityChoice | null;
  series?: IdentityChoice | null;
};

export type BottleCreateCandidate = Pick<Bottle, "fullName" | "id" | "name"> &
  Partial<BottleCreateCandidateFacts> & {
    brand: IdentityChoice;
    distillers: readonly IdentityChoice[];
    bottler?: IdentityChoice | null;
    series?: IdentityChoice | null;
  };

const GENERIC_NAME_WORDS = new Set([
  "aged",
  "bottle",
  "old",
  "scotch",
  "the",
  "whiskey",
  "whisky",
  "year",
  "years",
  "yo",
]);

const TRAILING_QUALIFIERS = new Set([
  "batch",
  "collection",
  "edition",
  "release",
  "series",
]);

function words(value: string): string[] {
  return (
    value
      .normalize("NFKD")
      .replace(/\p{Mark}/gu, "")
      .toLocaleLowerCase()
      .match(/[\p{Letter}\p{Number}]+/gu) ?? []
  );
}

function normalized(value: string): string {
  return words(value).join(" ");
}

function identityChoices(input: BottleCreateCandidateInput): IdentityChoice[] {
  return [
    ...(input.brand ? [input.brand] : []),
    ...(input.distillers ?? []),
    ...(input.bottler ? [input.bottler] : []),
    ...(input.series ? [input.series] : []),
  ];
}

function withoutLeadingIdentity(
  nameWords: readonly string[],
  choices: readonly IdentityChoice[],
): string[] {
  let result = [...nameWords];
  if (result[0] === "the") result = result.slice(1);

  const identityNames = choices
    .map((choice) => words(choice.name))
    .filter((choiceWords) => choiceWords.length)
    .sort((left, right) => right.length - left.length);

  let changed = true;
  while (changed) {
    changed = false;
    for (const identityName of identityNames) {
      if (identityName.every((word, index) => result[index] === word)) {
        result = result.slice(identityName.length);
        if (result[0] === "the") result = result.slice(1);
        changed = true;
        break;
      }
    }
  }
  return result;
}

function withoutTrailingQualifier(nameWords: readonly string[]): string[] {
  const lastWord = nameWords.at(-1);
  const secondLastWord = nameWords.at(-2);
  if (lastWord && TRAILING_QUALIFIERS.has(lastWord)) {
    return nameWords.slice(0, Math.max(0, nameWords.length - 2));
  }
  if (secondLastWord && TRAILING_QUALIFIERS.has(secondLastWord)) {
    return nameWords.slice(0, Math.max(0, nameWords.length - 2));
  }
  return [...nameWords];
}

function distinctiveWords(nameWords: readonly string[]): string[] {
  return nameWords.filter(
    (word) => !GENERIC_NAME_WORDS.has(word) && !/^\d+$/.test(word),
  );
}

function nameVariants(
  name: string,
  choices: readonly IdentityChoice[],
): string[][] {
  const original = words(name);
  const withoutIdentity = withoutLeadingIdentity(original, choices);
  return [
    original,
    withoutTrailingQualifier(original),
    withoutIdentity,
    withoutTrailingQualifier(withoutIdentity),
  ].filter((variant) => variant.length > 0);
}

/**
 * Builds bounded discovery queries only. These variants are evidence for the
 * picker and never replace the marketed name submitted by the member.
 */
export function buildBottleCreateCandidateQueries(
  input: BottleCreateCandidateInput,
): string[] {
  const choices = identityChoices(input);
  const variants = nameVariants(input.name, choices);
  const usefulName = variants.some(
    (variant) => distinctiveWords(variant).length >= 2,
  );
  const supportedShortName =
    choices.length > 0 &&
    variants.some((variant) => distinctiveWords(variant).length >= 1);
  const supportedGenericName =
    choices.length > 0 &&
    variants.some((variant) => variant.length > 0) &&
    (input.statedAge != null || /\d/.test(input.name));

  if (!usefulName && !supportedShortName && !supportedGenericName) return [];

  return Array.from(
    new Set(variants.map((variant) => variant.join(" "))),
  ).slice(0, 4);
}

function sameChoice(
  input: IdentityChoice | null | undefined,
  candidate: IdentityChoice | null | undefined,
): boolean {
  if (!input || !candidate) return false;
  if (input.id && candidate.id) return input.id === candidate.id;
  return normalized(input.name) === normalized(candidate.name);
}

function hasChoiceOverlap(
  input: readonly IdentityChoice[] | undefined,
  candidates: readonly IdentityChoice[] | undefined,
): boolean {
  return Boolean(
    input?.some((inputChoice) =>
      candidates?.some((candidate) => sameChoice(inputChoice, candidate)),
    ),
  );
}

function textSimilarity(left: readonly string[], right: readonly string[]) {
  if (!left.length || !right.length) return 0;
  if (left.join(" ") === right.join(" ")) return 1;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const intersection = [...leftSet].filter((word) => rightSet.has(word)).length;
  return (2 * intersection) / (leftSet.size + rightSet.size);
}

function exactValueScore<T>(
  input: T | null | undefined,
  candidate: T | null | undefined,
  matchScore: number,
  mismatchScore: number,
) {
  if (input == null || candidate == null) return 0;
  return input === candidate ? matchScore : mismatchScore;
}

function exactTextScore(
  input: string | null | undefined,
  candidate: string | null | undefined,
  matchScore: number,
  mismatchScore: number,
) {
  if (!input || !candidate) return 0;
  return normalized(input) === normalized(candidate)
    ? matchScore
    : mismatchScore;
}

function candidateScore(
  input: BottleCreateCandidateInput,
  candidate: BottleCreateCandidate,
): number | null {
  const inputChoices = identityChoices(input);
  const inputVariants = nameVariants(input.name, inputChoices);
  const candidateChoices = [
    candidate.brand,
    ...candidate.distillers,
    ...(candidate.bottler ? [candidate.bottler] : []),
    ...(candidate.series ? [candidate.series] : []),
  ];
  const candidateVariants = [
    ...nameVariants(candidate.name, candidateChoices),
    ...nameVariants(candidate.fullName, candidateChoices),
  ];
  const similarity = Math.max(
    ...inputVariants.flatMap((inputVariant) =>
      candidateVariants.map((candidateVariant) =>
        textSimilarity(inputVariant, candidateVariant),
      ),
    ),
  );
  const inputDistinctive = new Set(
    inputVariants.flatMap((variant) => distinctiveWords(variant)),
  );
  const candidateDistinctive = new Set(
    candidateVariants.flatMap((variant) => distinctiveWords(variant)),
  );
  const distinctiveOverlap = [...inputDistinctive].filter((word) =>
    candidateDistinctive.has(word),
  ).length;
  const brandMatch = sameChoice(input.brand, candidate.brand);
  const distillerMatch = hasChoiceOverlap(
    input.distillers,
    candidate.distillers,
  );
  const identityMatch =
    brandMatch ||
    distillerMatch ||
    sameChoice(input.bottler, candidate.bottler) ||
    sameChoice(input.series, candidate.series);

  // A generic age-only name needs a matching stored identity anchor.
  if (inputDistinctive.size === 0 && !identityMatch) return null;
  if (similarity < 0.45 && distinctiveOverlap < 2) return null;

  let score = similarity * 100;
  if (brandMatch) score += 24;
  if (distillerMatch) score += 28;
  if (sameChoice(input.series, candidate.series)) score += 16;
  if (sameChoice(input.bottler, candidate.bottler)) score += 8;
  score += exactValueScore(input.category, candidate.category, 2, -2);
  score += exactValueScore(input.statedAge, candidate.statedAge, 8, -10);
  score += exactValueScore(
    input.noAgeStatement,
    candidate.noAgeStatement,
    8,
    -10,
  );
  score += exactValueScore(input.vintageYear, candidate.vintageYear, 8, -12);
  score += exactValueScore(input.bottlingYear, candidate.bottlingYear, 5, -8);
  score += exactValueScore(input.releaseYear, candidate.releaseYear, 8, -12);
  score += exactValueScore(input.releaseMonth, candidate.releaseMonth, 3, -4);
  score += exactValueScore(input.releaseDay, candidate.releaseDay, 2, -3);
  score += exactValueScore(input.singleCask, candidate.singleCask, 3, -3);
  score += exactValueScore(input.caskStrength, candidate.caskStrength, 3, -3);
  score += exactValueScore(input.naturalColor, candidate.naturalColor, 1, -1);
  score += exactValueScore(
    input.nonChillFiltered,
    candidate.nonChillFiltered,
    1,
    -1,
  );
  score += exactTextScore(input.maturation, candidate.maturation, 4, -4);
  score += exactTextScore(input.caskNumber, candidate.caskNumber, 16, -18);
  score += exactValueScore(input.outturn, candidate.outturn, 3, -3);
  if (input.abv != null && candidate.abv != null) {
    score += Math.abs(input.abv - candidate.abv) <= 0.1 ? 8 : -10;
  }
  if (input.edition && candidate.edition) {
    score +=
      normalized(input.edition) === normalized(candidate.edition) ? 12 : -14;
  }
  return score;
}

/** Ranks and deduplicates advisory candidates without deciding Bottle identity. */
export function rankBottleCreateCandidates<
  Candidate extends BottleCreateCandidate,
>(
  input: BottleCreateCandidateInput,
  candidates: readonly Candidate[],
  limit: number,
): Candidate[] {
  const bestById = new Map<number, { candidate: Candidate; score: number }>();
  for (const candidate of candidates) {
    const score = candidateScore(input, candidate);
    if (score == null) continue;
    const current = bestById.get(candidate.id);
    if (!current || score > current.score) {
      bestById.set(candidate.id, { candidate, score });
    }
  }
  return [...bestById.values()]
    .sort(
      (left, right) =>
        right.score - left.score || left.candidate.id - right.candidate.id,
    )
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}
