import { CATEGORY_LIST } from "@peated/server/constants";
import type {
  CaskFill,
  CaskSize,
  CaskType,
  Category,
  FlavorProfile,
} from "@peated/server/types";

// This needs moved into the database and needs to be editable by the community/mods
// https://www.whiskysaga.com/smws-codes
export const SMWS_DISTILLERY_CODES: Record<string, string> = {
  // Single Malt
  1: "Glenfarclas",
  2: "Glenlivet",
  3: "Bowmore",
  4: "Highland Park",
  5: "Auchentoshan",
  6: "Macduff",
  7: "Longmorn",
  8: "Tamdhu",
  9: "Glen Grant",
  10: "Bunnahabhain",
  11: "Tomatin",
  12: "BenRiach",
  13: "Dalmore",
  14: "Talisker",
  15: "Glenfiddich",
  16: "Glenturret",
  17: "Scapa",
  18: "Inchgower",
  19: "Glen Garioch",
  20: "Inverleven",
  21: "Glenglassaugh",
  22: "Glenkinchie",
  23: "Bruichladdich",
  24: "Macallan",
  25: "Rosebank",
  26: "Clynelish",
  27: "Springbank",
  28: "Tullibardine",
  29: "Laphroaig",
  30: "Glenrothes",
  31: "Isle of Jura",
  32: "Edradour",
  33: "Ardbeg",
  34: "Tamnavulin",
  35: "Glen Moray",
  36: "Benrinnes",
  37: "Cragganmore",
  38: "Caperdonich",
  39: "Linkwood",
  40: "Balvenie",
  41: "Dailuaine",
  42: "Tobermory",
  43: "Port Ellen",
  44: "Craigellachie",
  45: "Dallas Dhu",
  46: "Glenlossie",
  47: "Benromach",
  48: "Balmenach",
  49: "St. Magdalene",
  50: "Bladnoch",
  51: "Bushmills",
  52: "Old Pulteney",
  53: "Caol Ila",
  54: "Aberlour",
  55: "Royal Brackla",
  56: "Coleburn",
  57: "Glen Mhor",
  58: "Strathisla",
  59: "Teaninich",
  60: "Aberfeldy",
  61: "Brora",
  62: "Glenlochy",
  63: "Glentauchers",
  64: "Mannochmore",
  65: "Imperial",
  66: "Ardmore",
  67: "Banff",
  68: "Blair Athol",
  69: "Glen Albyn",
  70: "Balblair",
  71: "Glenburgie",
  72: "Miltonduff",
  73: "Aultmore",
  74: "North Port",
  75: "Glenury", // Glenury Royal
  76: "Mortlach",
  77: "Glen Ord",
  78: "Ben Nevis",
  79: "Deanston",
  80: "Glen Spey",
  81: "Glen Keith",
  82: "Glencadam",
  83: "Convalmore",
  84: "Glendullan",
  85: "Glen Elgin",
  86: "Glenesk",
  87: "Millburn",
  88: "Speyburn",
  89: "Tomintoul",
  90: "Pittyvaich",
  91: "Dufftown",
  92: "Lochside",
  93: "Glen Scotia",
  94: "Fettercairn",
  95: "Auchroisk",
  96: "GlenDronach",
  97: "Littlemill",
  98: "Inverleven",
  99: "Glenugie",
  100: "Strathmill",
  101: "Knockando",
  102: "Dalwhinnie",
  103: "Royal Lochnagar",
  104: "Glenburgie", // Glencraig
  105: "Tormore",
  106: "Cardhu",
  107: "Glenallachie",
  108: "Allt-a-Bhainne",
  109: "Miltonduff", // Mosstowie
  110: "Oban",
  111: "Lagavulin",
  112: "Loch Lomond", // Inchmurrin
  113: "Braeval", // Braes of Glenlivet
  114: "Springbank", // Longrow
  115: "Knockdhu", // AnCnoc
  116: "Yoichi",
  117: "Cooley", // (Unpeated)
  118: "Cooley", // Connemara (Peated)
  119: "Yamazaki",
  120: "Hakushu",
  121: "Isle of Arran",
  122: "Loch Lomond", // Croftengea
  123: "Glengoyne",
  124: "Miyagikyo",
  125: "Glenmorangie",
  126: "Springbank", // Hazelburn
  127: "Bruichladdich", // Port Charlotte
  128: "Penderyn",
  129: "Kilchoman",
  130: "Chichibu",
  131: "Hanyu",
  132: "Karuizawa",
  133: "Westland",
  134: "Paul John",
  135: "Loch Lomond", // Inchmoan
  136: "Eden Mill",
  137: "St. George's",
  138: "Nantou",
  139: "Kavalan",
  140: "Balcones",
  141: "Fary Lochan",
  142: "Breuckelen Distilling",
  143: "Copperworks Distilling Co.",
  144: "High Coast Distillery",
  145: "Smögen Whisky",
  146: "Cotswolds",
  147: "Archie Rose",
  148: "Starward",
  149: "Ardnamurchan",
  150: "West Cork Distillers",
  151: "Mackmyra",
  152: "Shelter Point",
  153: "Thy Whisky",
  154: "Mosgaard Whisky",
  155: "Milk & Honey Distillery",
  156: "Glasgow Distillery",
  157: "Armorik",
  158: "Yuza",
  159: "Komagatake",
  160: "Tsunuki",
  161: "Mc'nean Distillery",
  // 162:
  163: "Isle of Harris Distillery",

  // Single Grain
  G1: "North British",
  G2: "Carsebridge",
  G3: "Caledonian",
  G4: "Cameronbridge",
  G5: "Invergordon",
  G6: "Port Dundas",
  G7: "Girvan",
  G8: "Cambus",
  G9: "Loch Lomond",
  G10: "Strathclyde",
  G11: "Nikka Coffey Grain",
  G12: "Nikka Coffey Malt",
  G13: "Chita",
  G14: "Dumbarton",
  G15: "Loch Lomond", // Rhosdhu
  G16: "Glasgow Distillery",

  // Bourbon
  B1: "Heaven Hill",
  B2: "Bernheim",
  B3: "Rock Town",
  B4: "FEW Spirits",
  B5: "Cascade Hollow",
  B6: "Finger Lakes Distilling",
  B7: "Ross & Squibb",
  B8: "Woodinville Whiskey Co.",

  // Rye
  RW1: "FEW Spirits",
  RW2: "Finger Lakes Distilling",
  RW3: "New York Distilling Co.",
  RW4: "Peerless",
  RW5: "Lux Row Distillers",
  RW6: "Kyrö",
  RW7: "Journeyman",

  // Corn
  CW1: "Heaven Hill",
  CW2: "Baclones",

  // Rum
  R1: "Monymusk",
  R2: "Demerara Distillers", // El Dorado
  R3: "West Indies Rum",
  R4: "Trinidad Distillers", // Angostura
  R5: "Long Pond",
  R6: "Foursquare",
  R7: "Hampden",
  R8: "Compañía Licorera de Nicaragua", // Flor de Caña
  R9: "Varela Hermanos", // Ron Abuelo
  R10: "Trinidad Distiller’s",
  R11: "Worthy Park",
  R12: "Travellers",
  R13: "Caroni",
  R14: "Uitvlugt",

  // Armagnac
  A1: "Chateau de Lacaze",
  A2: "Domaine Laguille",
  A3: "J. Goudoulin", // Veuve Goudoulin
  A4: "Domaine d’Espérance",
  A5: "Chateau de Laubade",
  A6: "Domaine Lasalle",
  A7: "Domaine Lasalle",
  A8: "Domaine de Cavaillon",

  // Cognac
  C1: "Camus",
  C2: "Domaine de Chez Guérive",
  C3: "Louis Royer",
  C4: "Distillery D'Aumagne",
  C5: "Tiffon Cognac",
  C6: "M & H Bonneau",
  C7: "Guy Rateau",
  C8: "Marie C. Bodit",
  C9: "Robert Audebeau",

  // Gin
  GN1: "Glasgow Distillery Company",
  GN2: "Strathearn Distillers",
  GN3: "The Borders Distillery",
  GN4: "Boatyard Distillery",
  GN5: "Scottish Gin",
  GN6: "Holyrood Distillery",
  GN7: "Cotswolds",
};

export const SMWS_CATEGORY_LIST = [
  ["", "Single Malt Whisky"],
  ["G", "Single Grain Whisky"],
  ["B", "Bourbon"],
  ["RW", "Rye"],
  ["CW1", "Corn Whisky"],
  ["R", "Rum"],
  ["GN", "Gin"],
  ["C", "Cognac"],
  ["A", "Armagnac"],
];

export function getCategoryFromCask(caskNumber: string) {
  if (caskNumber.startsWith("GN")) {
    return "gin";
  } else if (caskNumber.startsWith("RW")) {
    return "rye";
  } else if (caskNumber.startsWith("CW1")) {
    // corn - where should it go?
    return null;
  } else if (caskNumber.startsWith("B")) {
    return "bourbon";
  } else if (caskNumber.startsWith("R")) {
    return "rum";
  } else if (caskNumber.startsWith("A")) {
    return "armagnac";
  } else if (caskNumber.startsWith("C")) {
    return "cognac";
  } else if (caskNumber.startsWith("G")) {
    return "single_grain";
  } else if (Number(caskNumber[0]) > 0) {
    return "single_malt";
  } else {
    return null;
  }
}

export type SMWSCaskDetails = {
  category: Category | null;
  name: string;
  distiller: string | null;
};

export function parseDetailsFromName(name: string): SMWSCaskDetails | null {
  const caskNumberMatch = name.match(
    /(Cask No\. )?([A-Z0-9]+\.[0-9]+)\s*(.+)?/i,
  );

  if (!caskNumberMatch) {
    return null;
  }
  const caskNumber = caskNumberMatch[2];
  const caskName = caskNumberMatch[3];

  const distillerMatch = caskNumber.match(/([A-Z0-9]+)\.[0-9]+/i);
  if (!distillerMatch) {
    return null;
  }

  const distillerNo = distillerMatch[1];
  if (!distillerNo) {
    return null;
  }

  const rawCategory = getCategoryFromCask(caskNumber);
  const category = CATEGORY_LIST.includes(rawCategory as any)
    ? (rawCategory as Category)
    : null;

  return {
    category,
    name: `${caskNumber} ${caskName || ""}`,
    distiller: SMWS_DISTILLERY_CODES[distillerNo],
  };
}

export function parseFlavorProfile(name: string): FlavorProfile | null {
  name = name.replace("&amp;", "&").replace(",", "");

  switch (name) {
    case "Young & Spritely":
      return "young_spritely";
    case "Sweet Fruit & Mellow":
    case "Sweet Fruity & Mellow":
      return "sweet_fruit_mellow";
    case "Spicy & Sweet":
      return "spicy_sweet";
    case "Spicy & Dry":
      return "spicy_dry";
    case "Deep Rich & Dried Fruit":
    case "Deep Rich & Dried Fruits":
      return "deep_rich_dried_fruit";
    case "Old & Dignified":
      return "old_dignified";
    case "Light & Delicate":
      return "light_delicate";
    case "Juicy Oak & Vanilla":
      return "juicy_oak_vanilla";
    case "Oily & Coastal":
      return "oily_coastal";
    case "Lightly Peated":
      return "lightly_peated";
    case "Peated":
      return "peated";
    case "Heavily Peated":
      return "heavily_peated";
    default:
      console.error(`Unknown flavor profile: ${name}`);
      return null;
  }
}

function parseFill(value: string): CaskFill | null {
  if (!value) return null;

  value = value.toLowerCase();
  switch (value) {
    case "new":
    case "1st fill":
    case "first fill":
      return "1st_fill";
    case "2nd fill":
    case "second fill":
      return "2nd_fill";
    case "refill":
      return "refill";
    default:
      return null;
  }
}

function parseType(value: string): CaskType | null {
  if (!value) return null;
  return value
    .toLowerCase()
    .replace("px", "pedro_ximenez")
    .replace(" ", "_") as CaskType;
}

export function parseCaskType(
  caskType: string,
): [CaskFill | null, CaskType | null, CaskSize | null] {
  const caskFillMatch = caskType.match(
    /(new|first fill|second fill|1st fill|2nd fill|refill)/i,
  );
  const caskTypeMatch = caskType.match(
    /(bourbon|oloroso|oak|px|rum|armagnac)/i,
  );
  const caskSizeMatch = caskType.match(/(barrique|barrel|hogshead|butt)/i);

  // new = 1st fill
  return [
    caskFillMatch ? parseFill(caskFillMatch[1]) : null,
    caskTypeMatch ? parseType(caskTypeMatch[1]) : null,
    caskSizeMatch ? (caskSizeMatch[1].toLowerCase() as CaskSize) : null,
  ];
}
