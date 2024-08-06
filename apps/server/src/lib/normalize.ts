import { CATEGORY_LIST } from "../constants";
import { type Category } from "../types";
import { formatCategoryName } from "./format";
import { stripSuffix } from "./strings";

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

export function normalizeCategory(name: string): Category | null {
  const nameLower = name.toLowerCase();
  if (CATEGORY_LIST.includes(nameLower as Category))
    return nameLower as Category;
  if (nameLower.startsWith("single malt") || nameLower.endsWith("single malt"))
    return "single_malt";
  for (const category of CATEGORY_LIST) {
    if (nameLower.startsWith(formatCategoryName(category).toLowerCase())) {
      return category as Category;
    }
  }
  return null;
}

// TODO: this is still semi problematic
export function normalizeEntityName(name: string): string {
  name = name.replace(/ (distillery|distillerie)$/i, "");
  return name;
}

// TODO: this is no longer normalizing a bottle name, lets rethink this code
type NormalizedBottle = {
  name: string;
  statedAge: number | null;
  vintageYear: number | null;
  releaseYear: number | null;
  caskStrength?: boolean | null;
  singleCask?: boolean | null;
};

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
  // try to ease UX and normalize common name components
  if (statedAge && name == `${statedAge}`)
    return {
      name: `${statedAge}${ageSuffix}`,
      statedAge,
      vintageYear,
      releaseYear,
      caskStrength,
      singleCask,
    };

  const currentYear = new Date().getFullYear();

  // any extraneous characters
  name = normalizeString(name);

  ({ name, statedAge } = normalizeBottleAge({ name, statedAge }));

  // this is primarily targeting Scotch Malt Whiskey Society bottles
  // "Cask No. X"
  if (!isFullName) {
    name = name.replace(/^Cask No\.? \b/i, "");
  }

  name = normalizeBottleBatchNumber(name);

  // identify age from [number]-year-old
  const match = name.match(/\b(\d{1,2})-year-old($|\s|,)/i);
  if (!statedAge && match) {
    statedAge = parseInt(match[1], 10);
  }

  // detect vintage - always keep this in the bottle name as its key to the identity
  // TODO: normalize?
  const vintageYearMatch = name.match(/\((\d{4}) vintage\)|(\d{4}) vintage/i);
  if (vintageYearMatch) {
    if (!vintageYear) {
      vintageYear = parseInt(vintageYearMatch[1] || vintageYearMatch[2], 10);
      if (vintageYear < 1900 || vintageYear > currentYear) vintageYear = null;
    }
  }

  // release is removed last, that way if its the only thing present, its still visible
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

  // TODO: these would be nice to simply move to form validation
  if (statedAge && vintageYear && vintageYear + statedAge > currentYear) {
    // invalid vintage - probably confused w/ release
    console.warn(
      "Invalid vintageYear (vintageYear must be less than the currentYear - statedAge).",
    );
    vintageYear = null;
  }

  // TODO: these would be nice to simply move to form validation
  if (statedAge && vintageYear && releaseYear) {
    if (releaseYear < vintageYear + statedAge) {
      // invalid release year
      releaseYear = null;
    }
  }

  if (
    name.match(
      /\bCask Strength|Barrel Strength|Barrel Proof|Full Proof|Natural Strength|Original Strength|Undiluted\b/i,
    )
  ) {
    caskStrength = true;
  }

  // TODO: remove this descriptor as its not interesting to the bottle name
  // except when its the only descriptor
  if (
    name.match(
      /\Single Cask|Single Barrel|Cask No.?|Cask Number|Barrel No.?|Barrel Number|Selected Cask\b/i,
    )
  ) {
    singleCask = true;
  }

  // move any segment thats enclaosed in quotations to the end
  name = name.replaceAll(/(^|[\s,])(\([^)]+\)),?\s(.+)$/gi, "$1 $3 $2");

  // remove invalid commas (", (foo)")
  name = name.replaceAll(/,\s+\(/g, " (");

  // trailing/leading whitespace
  name = name.replaceAll(/^\s*|\s*$/g, "");

  // replace excessive whitespace
  name = name.replaceAll(/\n\s+|\n+|\s{2,}/gi, " ");

  // vintage is likely wrong
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

function convertWordToNumber(word: string) {
  return NUMBERS[word.toLowerCase()] || word;
}

const AGE_NORM_REGEXP = new RegExp(
  `\\b(\\d{1,2}|${Object.keys(NUMBERS).join("|")})(?:[\\s-]?(?:years?|yrs?.?))(?:[\\s-]old)?($|[\\s,])`,
  "i",
);

const AGE_EXTRACT_REGEXP = new RegExp(
  `(${Object.keys(NUMBERS).join("|")})-year-old`,
  "i",
);

export function normalizeBottleAge({
  name,
  statedAge = null,
}: {
  name: string;
  statedAge?: number | null;
}): { name: string; statedAge: number | null } {
  // "years old" type patterns
  name = name.replace(AGE_NORM_REGEXP, `$1${ageSuffix}$2`);

  // TODO: this needs subbed in search too...
  name = name.replace(AGE_EXTRACT_REGEXP, (match, p1) => {
    return convertWordToNumber(p1) + "-year-old";
  });

  // normalize prefix/suffix numbers
  if (statedAge) {
    name = name.replace(
      new RegExp(`(^|\\s)(${statedAge})($|\\s)`),
      `$1${statedAge}${ageSuffix}$3`,
    );
  }

  // identify age from [number]-year-old
  const match = name.match(/\b(\d{1,2})-year-old($|\s|,)/i);
  if (!statedAge && match) {
    statedAge = parseInt(match[1], 10);
  }

  // move age to the beginning of the bottle name if brandPrefix is available,
  // if (!isFullName) {
  //   const ageMatch = name.match(/(\d{1,2})-year-old($|\s)/i);
  //   if (ageMatch) {
  //     name = `${ageMatch[1]}-year-old${ageMatch[2] || ""} ${name.replace(/(\s?\d{1,2}-year-old\s?)($|\s)/i, "$2")}`;
  //   }
  // }

  return { name, statedAge };
}

/**
 * Replace variants of `Batch [Number]` with standarded form of `Batch [number]`.
 *
 * @param name
 * @returns
 */
export function normalizeBottleBatchNumber(name: string) {
  // TODO: regexp
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

/* Normalize volume to milliliters */
export function normalizeVolume(volume: string): number | null {
  const match = volume.match(/^\s*([0-9.]+)\s?(ml|l)\s*,?(\sbottle)?$/i);
  if (!match) return null;

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

export function normalizeString(value: string): string {
  // remove smart quotes
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u00ae\u2122]/g, "");
}
