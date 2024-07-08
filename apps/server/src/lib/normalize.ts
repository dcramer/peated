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

  name = name.replace(/\n/, " ").replace(/\s{2,}/, " ");

  // "years old" type patterns
  name = name
    .replace(/(\d+)[\s-]?years?[\s-]old($|\s)/i, `$1${ageSuffix}$2`)
    .replace(/(\d+)[\s-]?years?($|\s)/i, `$1${ageSuffix}$2`);

  // abberviated yr
  name = name
    .replace(/(\d+)\s?yrs?\.?[\s-]old($|\s)/i, `$1${ageSuffix}$2`)
    .replace(/(\d+)\s?yrs?\.?($|\s)/i, `$1${ageSuffix}$2`);

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

  const match = name.match(/(\d+)-year-old($|\s)/i);
  if (!age && match) {
    age = parseInt(match[1], 10);
  }

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
