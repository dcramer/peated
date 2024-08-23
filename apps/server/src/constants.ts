export const DEFAULT_CREATED_BY_ID = 1;

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

export const EXTERNAL_SITE_TYPE_LIST = [
  "astorwines",
  "healthyspirits",
  "reservebar",
  "smws",
  "smwsa",
  "totalwine",
  "woodencork",
  "whiskyadvocate",
] as const;

export const ENTITY_TYPE_LIST = ["brand", "bottler", "distiller"] as const;

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

// blame theo for this monstrosity
const createTuple = <T extends Readonly<{ id: string }[]>>(arr: T) =>
  arr.map((s) => s.id) as {
    [K in keyof T]: T[K] extends { id: infer U } ? U : never;
  };

export const CASK_FILLS = ["1st_fill", "2nd_fill", "refill", "other"] as const;

export const CASK_TYPES = [
  { id: "bourbon", category: "whisky" },
  { id: "amontilado", category: "sherry" },
  { id: "fino", category: "sherry" },
  { id: "manzanilla", category: "sherry" },
  { id: "oloroso", category: "sherry" },
  { id: "palo_cortado", category: "sherry" },
  { id: "pedro_ximenez", category: "sherry", shortName: "px" },
  { id: "liqueur_muscat", category: "fortified_wine" },
  { id: "madeira", category: "fortified_wine" },
  { id: "marsala", category: "fortified_wine" },
  { id: "tawny_port", category: "fortified_wine" },
  { id: "ruby_port", category: "fortified_wine" },
  { id: "rose_port", category: "fortified_wine" },
  { id: "white_port", category: "fortified_wine" },
  { id: "amarone", category: "wine" },
  { id: "barolo", category: "wine" },
  { id: "bordeaux", category: "wine" },
  { id: "burgundy", category: "wine" },
  { id: "chardonnay", category: "wine" },
  { id: "muscat", category: "wine" },
  { id: "sauternes", category: "wine" },
  { id: "tokaji", category: "wine" },
  { id: "rum_white", category: "rum" },
  { id: "rum_dark", category: "rum" },
  { id: "cognac", category: "cognac" },
  { id: "oak", category: "wood" },
  { id: "other", category: "other" },
] as const;

export const CASK_TYPE_IDS = createTuple(CASK_TYPES);

export const CASK_SIZES = [
  { id: "quarter_cask", size: [45, 50] },
  {
    id: "barrel",
    size: [190, 200],
  },
  { id: "hogshead", size: [225, 250] },
  { id: "barrique", size: [225, 300] },
  { id: "puncheon", size: [450, 500] },
  { id: "butt", size: [475, 500] },
  { id: "port_pipe", size: [550, 650] },
  { id: "madeira_drum", size: [600, 650] },
] as const;

export const CASK_SIZE_IDS = createTuple(CASK_SIZES);

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

export const BOT_USER_AGENT = "PeatedBot/1.0 (https://peated.com)";

export const ALLOWED_VOLUMES = [500, 750, 1000, 1500];

export const SCRAPER_PRICE_BATCH_SIZE = 5;
