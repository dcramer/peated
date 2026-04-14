import { CATEGORY_LIST } from "./classifierSchemas";

const ageSuffix = "-year-old";

const NUMBERS: Record<string, string> = {
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
  thirteen: "13",
  fourteen: "14",
  fifteen: "15",
  sixteen: "16",
  seventeen: "17",
  eighteen: "18",
  nineteen: "19",
  twenty: "20",
};

function convertWordToNumber(word: string) {
  return NUMBERS[word.toLowerCase()] || word;
}

const AGE_NORM_REGEXP = new RegExp(
  `\\b(\\d{1,2}|${Object.keys(NUMBERS).join("|")})(?:[\\s-]?(?:years?|yrs?\\.?|y\\.?o\\.?))(?:[\\s-]old)?($|[\\s,])`,
  "i",
);

const AGE_EXTRACT_REGEXP = new RegExp(
  `(${Object.keys(NUMBERS).join("|")})-year-old`,
  "i",
);

export function normalizeString(value: string): string {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u00ae\u2122]/g, "");
}

function formatCategoryNameForMatch(
  category: (typeof CATEGORY_LIST)[number],
): string {
  return category.replace(/_/g, " ");
}

export function normalizeCategory(
  name: string,
): (typeof CATEGORY_LIST)[number] | null {
  const normalizedName = name.toLowerCase();
  if (
    CATEGORY_LIST.includes(normalizedName as (typeof CATEGORY_LIST)[number])
  ) {
    return normalizedName as (typeof CATEGORY_LIST)[number];
  }

  if (
    normalizedName.startsWith("single malt") ||
    normalizedName.endsWith("single malt")
  ) {
    return "single_malt";
  }

  for (const category of CATEGORY_LIST) {
    if (normalizedName.startsWith(formatCategoryNameForMatch(category))) {
      return category;
    }
  }

  return null;
}

export function normalizeEntityName(name: string): string {
  return name;
}

export function stripDuplicateBrandPrefixFromBottleName(
  name: string,
  brandName: string | null | undefined,
): string {
  if (!brandName) {
    return name;
  }

  const prefix = `${brandName} `;
  if (name.toLowerCase().startsWith(prefix.toLowerCase())) {
    return name.substring(prefix.length);
  }

  return name;
}

export type NormalizedBottle = {
  name: string;
  statedAge: number | null;
  vintageYear: number | null;
  releaseYear: number | null;
  caskStrength?: boolean | null;
  singleCask?: boolean | null;
};

export function normalizeBottleAge({
  name,
  statedAge = null,
}: {
  name: string;
  statedAge?: number | null;
}): { name: string; statedAge: number | null } {
  name = name.replace(AGE_NORM_REGEXP, `$1${ageSuffix}$2`);
  name = name.replace(AGE_EXTRACT_REGEXP, (match, p1) => {
    return convertWordToNumber(p1) + "-year-old";
  });

  if (statedAge) {
    name = name.replace(
      new RegExp(`(^|\\s)(${statedAge})($|\\s)`),
      `$1${statedAge}${ageSuffix}$3`,
    );
  }

  const match = name.match(/\b(\d{1,2})-year-old($|\s|,)/i);
  if (!statedAge && match) {
    statedAge = parseInt(match[1], 10);
  }

  return { name, statedAge };
}

export function normalizeBottleBatchNumber(name: string) {
  if (name.toLowerCase().indexOf("small batch") !== -1) return name;
  return name.replace(
    /(?:,)?(^|\s)?(?:(?:\()batch (no.?\s|number\s|#)?([^)]+)(?:\))|batch (no.?\s|number\s|#)?((?!kentucky|proof)[^,\s]+))(?:,)?($|\s)?/i,
    (fullMatch, ...match: string[]) => {
      if (name == fullMatch)
        return `Batch ${convertWordToNumber(match[2] || match[4])}`;
      if (match[2])
        return `${match[0] || ""}(Batch ${convertWordToNumber(match[2])})${match[5] || ""}`;
      else
        return `${match[0] || ""}(Batch ${convertWordToNumber(match[4])})${match[5] || ""}`;
    },
  );
}

export function normalizeBottle({
  name,
  statedAge = null,
  vintageYear = null,
  releaseYear = null,
  caskStrength = null,
  singleCask = null,
  isFullName = true,
}: {
  name: string;
  statedAge?: number | null;
  vintageYear?: number | null;
  releaseYear?: number | null;
  caskStrength?: boolean | null;
  singleCask?: boolean | null;
  isFullName?: boolean;
}): NormalizedBottle {
  if (statedAge && name == `${statedAge}`) {
    return {
      name: `${statedAge}${ageSuffix}`,
      statedAge,
      vintageYear,
      releaseYear,
      caskStrength,
      singleCask,
    };
  }

  const currentYear = new Date().getFullYear();

  name = normalizeString(name);
  ({ name, statedAge } = normalizeBottleAge({ name, statedAge }));

  if (!isFullName) {
    name = name.replace(/^Cask No\.? \b/i, "");
  }

  name = normalizeBottleBatchNumber(name);

  const match = name.match(/\b(\d{1,2})-year-old($|\s|,)/i);
  if (!statedAge && match) {
    statedAge = parseInt(match[1], 10);
  }

  const vintageYearMatch = name.match(/\((\d{4}) vintage\)|(\d{4}) vintage/i);
  if (vintageYearMatch) {
    if (!vintageYear) {
      vintageYear = parseInt(vintageYearMatch[1] || vintageYearMatch[2], 10);
      if (vintageYear < 1900 || vintageYear > currentYear) vintageYear = null;
    }
  }

  const releaseYearMatch = name.match(/\((\d{4}) release\)|(\d{4}) release/i);
  if (releaseYearMatch) {
    if (!releaseYear) {
      releaseYear = parseInt(releaseYearMatch[1] || releaseYearMatch[2], 10);
      if (releaseYear < 1900 || releaseYear > currentYear) releaseYear = null;
    }
  }
  if (releaseYear) {
    name =
      name.replace(
        new RegExp(
          `(\\s${releaseYear}$|\\(${releaseYear}\\)($|\\s)|\\(${releaseYear} release\\)($|\\s)|${releaseYear} release($|\\s))`,
          "i",
        ),
        "",
      ) || name;
  }

  if (statedAge && vintageYear && vintageYear + statedAge > currentYear) {
    vintageYear = null;
  }

  if (statedAge && vintageYear && releaseYear) {
    if (releaseYear < vintageYear + statedAge) {
      releaseYear = null;
    }
  }

  if (
    name.match(
      /\bCask Strength|Barrel Strength|Barrel Proof|Full Proof|Natural Strength|Original Strength|Undiluted|Cask Bottling\b/i,
    )
  ) {
    caskStrength = true;
  }

  if (
    name.match(
      /\Single Cask|Single Barrel|Cask No.?|Cask Number|Barrel No.?|Barrel Number|Selected Cask\b/i,
    )
  ) {
    singleCask = true;
  }

  name = name.replaceAll(/(^|[\s,])(\([^)]+\)),?\s(.+)$/gi, "$1 $3 $2");
  name = name.replaceAll(/,\s+\(/g, " (");
  name = name.replaceAll(/^\s*|\s*$/g, "");
  name = name.replaceAll(/\n\s+|\n+|\s{2,}/gi, " ");

  if (releaseYear === vintageYear) {
    vintageYear = null;
  }

  return {
    name,
    statedAge,
    vintageYear,
    releaseYear,
    caskStrength,
    singleCask,
  };
}

export function normalizeVolume(volume: string): number | null {
  const match = volume.match(/^\s*([0-9.]+)\s?(ml|l)\s*,?(\sbottle)?$/i);
  if (!match) {
    return null;
  }

  const [amount, measure] = match.slice(1, 3);

  switch (measure.toLowerCase()) {
    case "l":
      return parseFloat(amount) * 1000;
    case "ml":
      return parseInt(amount, 10);
    default:
      return null;
  }
}
