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

  // "years old" type patterns
  name = name
    .replace(
      /(\d{1,2}|ten|twelve|fifteen|twenty)[\s-]?years?[\s-]old($|\s)/i,
      `$1${ageSuffix}$2`,
    )
    .replace(
      /(\d{1,2}|ten|twelve|fifteen|twenty)[\s-]?years?($|\s)/i,
      `$1${ageSuffix}$2`,
    );

  // abberviated yr
  name = name
    .replace(
      /(\d{1,2}|ten|twelve|fifteen|twenty)\s?yrs?\.?[\s-]old($|\s)/i,
      `$1${ageSuffix}$2`,
    )
    .replace(
      /(\d{1,2}|ten|twelve|fifteen|twenty)\s?yrs?\.?($|\s)/i,
      `$1${ageSuffix}$2`,
    );

  // TODO: this needs subbed in search too...
  name = name.replace(/ten-year-old/i, "10-year-old");
  name = name.replace(/twelve-year-old/i, "12-year-old");
  name = name.replace(/fifteen-year-old/i, "15-year-old");
  name = name.replace(/twenty-year-old/i, "20-year-old");

  if (name.startsWith(`${age} `)) {
    name = name.replace(`${age} `, `${age}${ageSuffix} `);
  }
  if (name.endsWith(` ${age}`)) {
    name = `${name}${ageSuffix}`;
  }

  // this is primarily targeting Scotch Malt Whiskey Society bottles
  if (name.startsWith("Cask No. ")) {
    name = name.substring(9);
  }

  // replace mid-string age
  name = name.replace(` ${age} `, ` ${age}${ageSuffix} `);

  const match = name.match(/(\d{1,2})-year-old($|\s)/i);
  if (!age && match) {
    age = parseInt(match[1], 10);
  }

  if (match) {
    name = `${match[1]}-year-old ${name.replace(/(\b\d{1,2}-year-old)($|\s)/i, "")}`;
  }

  // replace various whitespace
  name = name.replace(/\n/, " ").replace(/\s{2,}/, " ");

  return [normalizeString(name), age];
};

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
