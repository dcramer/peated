// this is some early work on putting a rule-based matcher to code

import { CATEGORY_LIST } from "./constants";
import { formatCategoryName } from "./lib/format";

const BOTTLE_CASES = [
  "Aberfeldy 12-year-old",
  "Aberfeldy 18-year-old",
  "Aberfeldy 18-year-old Port Cask",
  "The Aberfeldy 12-year-old",
  "High West American Single Malt",
  "High West Bourye",
  "Old Trestle Double Barreled Bourbon",
  "291 Colorado Bourbon",
];

// emulate shortName here for 291 Colorado Whiskey => 291 Colorado
const ENTITY_CASES = ["Aberfeldy", "291 Colorado Whiskey", "291 Colorado"];

const CASES_TO_TEST = [
  // input, expected
  ["Aberfeldy 12-year-old", "Aberfeldy 12-year-old"],
  ["Aberfeldy 18-year-old", "Aberfeldy 18-year-old"],
  ["Aberfeldy 18-year-old Port Cask", "Aberfeldy 18-year-old Port Cask"],
  ["Aberfeldy 18-year-old Single Malt Scotch Whisky", "Aberfeldy 18-year-old"],
  [
    "Aberfeldy 18-year-old Single Malt Port Cask",
    "Aberfeldy 18-year-old Port Cask",
  ],
  // TODO:
  // [
  //   "291 Colorado Bourbon Whiskey, Finished with Aspen Wood Staves, Barrel Proof, Single Barrel",
  //   "291 Colorado Bourbon",
  // ],
  // [
  //   "Aberfeldy 18-year-old Limited Edition Tuscan Red Wine Cask Finish",
  //   "Aberfeldy 18-year-old Tuscan Red Wine Cask Finish",
  // ],
];

function escapeRegex(value: string) {
  return value.replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&");
}

function removeNoise(value: string) {
  let newValue = value;

  // removing categories is a misnomer, so maybe we should add them instead????
  const categoryRe = new RegExp(
    `\\b(${CATEGORY_LIST.map(formatCategoryName).map(escapeRegex).join("|")})\\b`,
    "i"
  );
  newValue = newValue.replace(categoryRe, "");

  // remove common suffixes
  newValue = newValue.replaceAll(/\b(whisky|whiskey|scotch)\b/gi, "");

  return newValue.replace(/\s\s+/i, " ").trim();
}

// lets talk about what names contain
// [BrandName] [LabelName] is almost always the pattern
// [BrandName] sometimes will _rarely_ not be present, but can also be labeled multiple ways:
// - Brand
// - The [Brand]
// - [BrandAcronym]
// [LabelName] is complex, and contains a lot of structured data:
// - stated age, in a variety of forms (12, 12-year-old, 12 years old, Twelve)
// - spirit style (Single Malt, Single Malt Scotch Whisky, Bourbon)
// - various adjectives that are not always present (Limited Edition, Single Cask)
// - information that we don't have a use for (Batch No)
// - vintage or year of release (2023, 2023 Release, 2023 Edition)

function match(
  inputName: string,
  possibleEntities: string[],
  possibleBottles: string[]
) {
  const commonTokens = /\b(the|of)\b/i;

  console.log(`Searching for [${inputName}]`);

  const inputNameLower = inputName.toLowerCase();

  const brand = possibleEntities
    .sort((a, b) => b.length - a.length)
    .find((entity) =>
      inputNameLower.startsWith(entity.toLocaleLowerCase() + " ")
    );

  console.log(`  Brand identified as [${brand}]`);
  if (!brand) return null;

  const inputBottleName = inputName.slice(brand.length + 1);

  console.log(`  Parsed bottle name as [${inputBottleName}]`);

  const searchedName = removeNoise(`${brand} ${inputBottleName}`.toLowerCase());
  console.log(`    Looking for [${searchedName}]`);
  const bottle = possibleBottles
    .sort((a, b) => b.length - a.length)
    .find((bottle) => removeNoise(bottle.toLowerCase()) == searchedName);

  console.log(`  Bottle identified as [${bottle}]`);
  if (!bottle) return null;

  return bottle;
}

test("matcher", () => {
  for (const [input, expected] of CASES_TO_TEST) {
    const result = match(input, ENTITY_CASES, BOTTLE_CASES);

    // console.log(`Matched [${input}] to [${result}]`);
    expect(result).toEqual(expected);
  }
});
