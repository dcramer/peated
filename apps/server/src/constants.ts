export const MAX_FILESIZE = 1048576 * 20;

export const MAJOR_COUNTRIES = [
  ["Scotland", "scotland"],
  ["Ireland", "ireland"],
  ["United States of America", "united-states"],
  ["Canada", "canada"],
  ["Japan", "japan"],
  ["Australia", "australia"],
  ["India", "india"],
] as const;

export const CATEGORY_LIST = [
  "blend",
  "bourbon",
  "rye",
  "single_grain",
  "single_malt",
  "single_pot_still",
  "spirit",
] as const;

export const SERVING_STYLE_LIST = ["neat", "rocks", "splash"] as const;

export const RESERVED_COLLECTION_SLUGS = ["default", "library"] as const;
export type ReservedCollectionSlug = (typeof RESERVED_COLLECTION_SLUGS)[number];

export const EXTERNAL_SITE_DEFINITIONS = {
  // Astor stays manual-only while its non-browser catalog behavior is checked.
  astorwines: { name: "Astor Wines", runEvery: null },
  berrybrosrudd: { name: "Berry Bros. & Rudd", runEvery: 10080 },
  bruichladdich: { name: "Bruichladdich", runEvery: 10080 },
  cadenheads: { name: "Cadenheads", runEvery: 10080 },
  compassbox: { name: "Compass Box", runEvery: 10080 },
  decadentdrinks: { name: "Decadent Drinks", runEvery: 10080 },
  douglaslaing: { name: "Douglas Laing", runEvery: 10080 },
  // Robots blocks the JSON catalog. Keep manual runs available while the
  // scheduled source waits for an allowed adapter.
  dramfool: { name: "Dramfool", runEvery: null },
  edradour: { name: "Edradour", runEvery: 10080 },
  finedrams: { name: "Fine Drams", runEvery: 10080 },
  glenallachie: { name: "The GlenAllachie", runEvery: 10080 },
  gordonmacphail: { name: "Gordon Macphail", runEvery: 10080 },
  healthyspirits: { name: "Healthy Spirits", runEvery: 10080 },
  kilchoman: { name: "Kilchoman", runEvery: 10080 },
  masterofmalt: { name: "Master of Malt", runEvery: 10080 },
  missionliquor: { name: "Mission Liquor", runEvery: 10080 },
  ncnean: { name: "Nc'nean", runEvery: 10080 },
  northstarspirits: { name: "North Star", runEvery: 10080 },
  reservebar: { name: "ReserveBar", runEvery: 10080 },
  singlecasknation: { name: "Single Cask Nation", runEvery: 10080 },
  smws: { name: "The Scotch Malt Whisky Society", runEvery: 10080 },
  smwsa: {
    name: "The Scotch Malt Whisky Society (America)",
    runEvery: 10080,
  },
  thompsonbros: { name: "Thompson Bros.", runEvery: 10080 },
  // Total Wine requires an interactive human-verification challenge. Its
  // traffic target remains disabled while existing data stays visible.
  totalwine: { name: "Total Wines", runEvery: null },
  woodencork: { name: "Wooden Cork", runEvery: 10080 },
  bourbonculture: {
    name: "Bourbon Culture",
    runEvery: 1440,
    content: "reviews",
  },
  dramface: {
    name: "Dramface",
    runEvery: 1440,
    content: "reviews",
  },
  fredminnick: {
    name: "Fred Minnick",
    runEvery: 1440,
    content: "reviews",
  },
  whiskeyreviewer: {
    name: "The Whiskey Reviewer",
    runEvery: 1440,
    content: "reviews",
  },
  whiskyadvocate: {
    name: "Whisky Advocate",
    runEvery: null,
    content: "reviews",
  },
  whiskyfun: {
    name: "Whiskyfun",
    runEvery: 1440,
    content: "reviews",
  },
  whiskysaga: {
    name: "Whisky Saga",
    runEvery: 1440,
    content: "reviews",
  },
  whiskystudy: {
    name: "The Whisky Study",
    runEvery: 1440,
    content: "reviews",
  },
  whiskynotes: {
    name: "WhiskyNotes",
    runEvery: 1440,
    content: "reviews",
  },
  wordsofwhisky: {
    name: "Words of Whisky",
    runEvery: 1440,
    content: "reviews",
  },
  whiskyworld: { name: "The Whisky World", runEvery: 10080 },
} as const;

type ExternalSiteDefinitionType = keyof typeof EXTERNAL_SITE_DEFINITIONS;

const externalSiteTypes = Object.keys(EXTERNAL_SITE_DEFINITIONS);
export const EXTERNAL_SITE_TYPE_LIST =
  // SAFETY: Object.keys returns the keys of this non-empty, code-owned object.
  externalSiteTypes as [
    ExternalSiteDefinitionType,
    ...ExternalSiteDefinitionType[],
  ];

export function isExternalReviewSiteType(type: ExternalSiteDefinitionType) {
  const definition = EXTERNAL_SITE_DEFINITIONS[type];
  return "content" in definition && definition.content === "reviews";
}

export const ENTITY_TYPE_LIST = ["brand", "bottler", "distiller"] as const;

export const ENTITY_KIND_LIST = [
  "brand",
  "distillery",
  "bottler",
  "blender",
  "company",
] as const;

export const ENTITY_EVENT_KIND_LIST = [
  "generic",
  "opened",
  "closed",
  "mothballed",
  "reopened",
  "acquired",
] as const;

export const BADGE_FORMULA_LIST = ["default", "linear", "fibonacci"] as const;

export const BADGE_CHECK_TYPE_LIST = [
  "age",
  "bottle",
  "entity",
  "region",
  "category",
  "everyTasting",
] as const;

export const BADGE_TRACKER_LIST = [
  "bottle",
  "entity",
  "country",
  "region",
] as const;

// https://whiskeytrends.com/whiskey-tasting-terminology/
// https://www.bonigala.com/25-ways-to-describe-whisky

export const FLAVOR_PROFILES = [
  "young_spritely",
  "sweet_fruit_mellow",
  "spicy_sweet",
  "spicy_dry",
  "deep_rich_dried_fruit",
  "old_dignified",
  "light_delicate",
  "juicy_oak_vanilla",
  "oily_coastal",
  "lightly_peated",
  "peated",
  "heavily_peated",
] as const;

// TODO: maybe utilize https://www.whiskymax.co.uk/charles-macleans-whisky-wheel/
// instead? its a bit easier to reason about for
export const TAG_CATEGORIES = [
  "cereal",
  "fruity",
  "floral",
  "peaty",
  "feinty",
  "sulphury",
  "woody",
  "winey",
] as const;

// TODO: reference whisky magazine for numerical, but simplify
export const COLOR_SCALE = [
  [0, "Clear", "#ffffff"],
  [1, "White Wine", "#fffbe0"],
  [2, "Melon Yellow", "#fdeda2"],
  [3, "Fine Sherry", "#faea8a"],
  [4, "Pale Honey", "#f7e07a"],
  [5, "Pale Gold", "#f5db6d"],
  [6, "Medium Gold", "#f5d863"],
  [7, "Deep Gold", "#f0ce62"],
  [8, "Amontillado Sherry", "#f0c962"],
  [9, "Pale Brown", "#efc358"],
  [10, "Medium Brown", "#efbf50"],
  [11, "Deep Brown", "#e0ae3d"],
  [12, "Palo Coratdo Sherry", "#dea03d"],
  [13, "Burnt Amber", "#da9635"],
  [14, "Copper", "#cf7831"],
  [15, "Tawny", "#d06c3a"],
  [16, "Deep Tawhny", "#bf573a"],
  [17, "Oloroso Sherry", "#a23a2f"],
  [18, "Vintage Oak", "#932e24"],
  [19, "Moscatel Sherry", "#6a3022"],
  [20, "Black Bowmore", "#3b1d12"],
] as const;

export const CURRENCY_LIST = ["usd", "gbp", "eur"] as const;

// used for web scraping
export const defaultHeaders = (url: string) => {
  const urlParts = new URL(url);
  return {
    Authority: urlParts.hostname,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7,",
    "Accept-Language": "en-US,en:q=0.9",
    Referer: urlParts.origin,
  };
};

export const BOT_USER_AGENT = "PeatedBot/1.0 (+https://peated.com/bot)";

export const ALLOWED_VOLUMES = [500, 700, 750, 1000, 1500, 1750];

export const SCRAPER_PRICE_BATCH_SIZE = 5;

export const SIMPLE_RATING_VALUES = {
  PASS: -1,
  SIP: 1,
  SAVOR: 2,
} as const;

export const SIMPLE_RATING_LABELS = {
  [-1]: "Pass",
  [1]: "Sip",
  [2]: "Savor",
} as const;

export const SIMPLE_RATING_DESCRIPTIONS = {
  [-1]: "Not my thing",
  [1]: "Enjoyable, would drink again",
  [2]: "Amazing, would seek out",
} as const;

export type SimpleRatingValue =
  (typeof SIMPLE_RATING_VALUES)[keyof typeof SIMPLE_RATING_VALUES];

export const RATING_SYSTEMS = ["simple", "advanced"] as const;
export type RatingSystem = (typeof RATING_SYSTEMS)[number];

export const ADVANCED_RATING_BANDS = [
  { min: 95, max: 100, label: "Extraordinary" },
  { min: 90, max: 94, label: "Exceptional" },
  { min: 85, max: 89, label: "Very good" },
  { min: 80, max: 84, label: "Good" },
  { min: 75, max: 79, label: "Fair" },
  { min: 0, max: 74, label: "Not recommended" },
] as const;

export type AdvancedRatingBand = (typeof ADVANCED_RATING_BANDS)[number];

export function getAdvancedRatingBand(
  score: number,
): AdvancedRatingBand | undefined {
  return ADVANCED_RATING_BANDS.find(
    (band) => score >= band.min && score <= band.max,
  );
}
