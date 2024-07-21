import { CATEGORY_LIST } from "../constants";
import { type Category } from "../types";
import { formatCategoryName } from "./format";

const ageSuffix = "-year-old";

export const normalizeCategory = (name: string): Category | null => {
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
};

export const normalizeEntityName = (name: string): string => {
  if (name.toLowerCase().endsWith(" distillery")) {
    name = name.replace(/ distillery$/i, "");
  }
  return name;
};

export const normalizeBottleName = (
  name: string,
  age: number | null = null,
): [string, number | null] => {
  // try to ease UX and normalize common name components
  if (age && name == `${age}`) return [`${age}${ageSuffix}`, age];

  name = name.replace("®", "");

  [name, age] = normalizeBottleAge(name, age);

  // this is primarily targeting Scotch Malt Whiskey Society bottles
  // "Cask No. X"
  name = name.replace(/\bCask No\.? \b/i, "");

  name = normalizeBottleBatchNumber(name);

  // replace various whitespace
  name = name.replace(/\n/, " ").replace(/\s{2,}/, " ");

  return [normalizeString(name), age];
};

export function normalizeBottleAge(
  name: string,
  age: number | null = null,
): [string, number | null] {
  // "years old" type patterns
  name = name
    .replace(/\b(\d{1,2}|\w+)[\s-]?years?[\s-]old($|\s)/i, `$1${ageSuffix}$2`)
    .replace(/(\d{1,2}|\w+)[\s-]?years?($|\s)/i, `$1${ageSuffix}$2`);

  // abberviated yr
  name = name
    .replace(/\b(\d{1,2}|\w+)\s?yrs?\.?[\s-]old($|\s)/i, `$1${ageSuffix}$2`)
    .replace(/\b(\d{1,2}|\w+)\s?yrs?\.?($|\s)/i, `$1${ageSuffix}$2`);

  // TODO: this needs subbed in search too...
  name = name.replace(/(\w+)-year-old/i, (match, p1) => {
    return convertWordToNumber(p1) + "-year-old";
  });

  // normalize prefix/suffix numbers
  if (age) {
    name = name.replace(
      new RegExp(`\\b(${age})($|\\s)`),
      `${age}${ageSuffix}$2`,
    );
  }

  // identify age from [number]-year-old
  const match = name.match(/\b(\d{1,2})-year-old($|\s)/i);
  if (!age && match) {
    age = parseInt(match[1], 10);
  }

  return [name, age];
}

/**
 * Replace variants of `Batch [Number]` with standarded form of `Batch [number]`.
 *
 * @param name
 * @returns
 */
export function normalizeBottleBatchNumber(name: string) {
  return name.replace(
    /\b(\()?batch (no.?\s|number\s|#)?(.+)($|\s)(\))?/i,
    (match, p1, p2, p3, p4, p5) => {
      return `(Batch ${convertWordToNumber(p3)})`;
    },
  );
}

function convertWordToNumber(word: string) {
  switch (word.toLowerCase()) {
    case "one":
      return "1";
    case "two":
      return "2";
    case "three":
      return "3";
    case "four":
      return "4";
    case "five":
      return "5";
    case "six":
      return "6";
    case "seven":
      return "7";
    case "eight":
      return "8";
    case "nine":
      return "9";
    case "ten":
      return "10";
    case "eleven":
      return "11";
    case "twelve":
      return "12";
    case "thirteen":
      return "13";
    case "fourteen":
      return "14";
    case "fifteen":
      return "15";
    case "sixteen":
      return "16";
    case "seventeen":
      return "17";
    case "eighteen":
      return "18";
    case "nineteen":
      return "19";
    case "twenty":
      return "20";
    default:
      return word;
  }
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
  return value.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
}
