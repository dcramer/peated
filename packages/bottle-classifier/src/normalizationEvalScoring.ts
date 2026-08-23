export type BottleNormalizationExactIdentity = {
  edition: string | null;
  releaseYear: number | null;
  vintageYear: number | null;
};

interface RomanNumerals {
  [value: string]: string | undefined;
}

function normalizeEdition(value: string | null | undefined) {
  const romanNumerals: RomanNumerals = {
    i: "1",
    ii: "2",
    iii: "3",
    iv: "4",
    v: "5",
    vi: "6",
    vii: "7",
    viii: "8",
    ix: "9",
    x: "10",
  };

  return (value ?? "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0 && token !== "the")
    .flatMap((token) => {
      if (token === "release") return [];
      if (token === "vol") return ["volume"];
      return [romanNumerals[token] ?? token];
    })
    .join(" ");
}

export function exactBottleIdentityMatches(
  actual: BottleNormalizationExactIdentity | null,
  expected: Partial<BottleNormalizationExactIdentity>,
) {
  if (actual === null) {
    return false;
  }

  if (
    "edition" in expected &&
    normalizeEdition(actual.edition) !== normalizeEdition(expected.edition)
  ) {
    return false;
  }

  if (
    "releaseYear" in expected &&
    actual.releaseYear !== expected.releaseYear
  ) {
    return false;
  }

  if (
    "vintageYear" in expected &&
    actual.vintageYear !== expected.vintageYear
  ) {
    return false;
  }

  return true;
}
