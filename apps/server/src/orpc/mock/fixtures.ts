import type { MockOutputs } from "./contract";

type Bottle = MockOutputs["bottles"]["list"]["results"][number];
type BottleDetails = MockOutputs["bottles"]["details"];
type BadgeAward = MockOutputs["users"]["badgeList"]["results"][number];
type Comment = MockOutputs["comments"]["list"]["results"][number];
type CollectionBottle =
  MockOutputs["collections"]["bottles"]["list"]["results"][number];
type Country = MockOutputs["countries"]["details"];
type Entity = MockOutputs["entities"]["list"]["results"][number];
type Flight = MockOutputs["flights"]["list"]["results"][number];
type Region = MockOutputs["regions"]["details"];
type Review = MockOutputs["reviews"]["list"]["results"][number];
type Tasting = MockOutputs["tastings"]["details"];
type User = MockOutputs["auth"]["login"]["user"];
type ActivityEntry = MockOutputs["activity"]["list"]["results"][number];

const timestamp = "2026-08-26T12:00:00.000Z";

// Keep records connected so each list result can open its detail route.

// Users
export const mockAccessToken = "peated-mock-access-token";

export const mockUser = {
  id: 9101,
  username: "mock-user",
  pictureUrl: null,
  private: false,
  ratingSystem: "simple",
  email: "mock@example.com",
  verified: true,
  admin: false,
  mod: false,
  createdAt: timestamp,
  termsAcceptedAt: timestamp,
  notifyComments: false,
  friendStatus: "none",
} satisfies User;

export const mockUserDetails = {
  ...mockUser,
  stats: {
    tastings: 42,
    bottles: 31,
    collected: 18,
    library: {
      total: 12,
      open: 4,
      sealed: 8,
    },
    contributions: 7,
  },
} satisfies MockOutputs["users"]["details"];

export const mockPublicUser = {
  id: mockUser.id,
  username: mockUser.username,
  pictureUrl: mockUser.pictureUrl,
  private: mockUser.private,
  friendStatus: mockUser.friendStatus,
} satisfies User;

export const mockFriends = [
  {
    id: 9102,
    username: "islay-dreamer",
    pictureUrl: null,
    private: false,
    friendStatus: "friends",
  },
  {
    id: 9103,
    username: "bourbon-notes",
    pictureUrl: null,
    private: false,
    friendStatus: "friends",
  },
] satisfies User[];

export const mockPublicUserDetails = {
  ...mockPublicUser,
  stats: mockUserDetails.stats,
} satisfies MockOutputs["users"]["details"];

export const mockFriendDetails = [
  {
    ...mockFriends[0]!,
    stats: {
      tastings: 128,
      bottles: 82,
      collected: 64,
      library: { total: 20, open: 7, sealed: 13 },
      contributions: 18,
    },
  },
  {
    ...mockFriends[1]!,
    stats: {
      tastings: 86,
      bottles: 65,
      collected: 40,
      library: { total: 9, open: 3, sealed: 6 },
      contributions: 5,
    },
  },
] satisfies MockOutputs["users"]["details"][];

export const mockPublicUserDetailsList = [
  mockPublicUserDetails,
  ...mockFriendDetails,
];

export function mockUserDetailsFor(
  user: User | null,
  profile: MockOutputs["users"]["details"] = mockPublicUserDetails,
) {
  return user?.id === profile.id ? { ...profile, ...user } : profile;
}

export function matchesMockUser(value: string | number, user: User | null) {
  return value === "me"
    ? Boolean(user)
    : mockPublicUserDetailsList.some(
        (profile) => value === profile.id || value === profile.username,
      );
}

// Places
export const mockCountry = {
  id: 9401,
  name: "Scotland",
  slug: "scotland",
  description: "A major whisky-producing country.",
  summary: "Home to distinct whisky regions and styles.",
  location: [-4.2, 56.5],
  totalBottles: 8200,
  totalDistillers: 150,
} satisfies Country;

export const mockCountries: Country[] = [
  mockCountry,
  {
    id: 9402,
    name: "Ireland",
    slug: "ireland",
    description:
      "Known for blended whiskey and single pot still whiskey made from malted and unmalted barley.",
    summary: "The home of Irish whiskey and the single pot still style.",
    location: [-8, 53.4],
    totalBottles: 1100,
    totalDistillers: 42,
  },
  {
    id: 9403,
    name: "United States of America",
    slug: "united-states",
    description:
      "A large whiskey-producing country best known for bourbon and rye.",
    summary: "Bourbon, rye, and a growing range of regional whiskey styles.",
    location: [-98.6, 39.8],
    totalBottles: 6100,
    totalDistillers: 2100,
  },
  {
    id: 9404,
    name: "Japan",
    slug: "japan",
    description:
      "Produces precise blends and single malts influenced by Scottish methods.",
    summary: "Elegant blends and single malts from a varied climate.",
    location: [138.3, 36.2],
    totalBottles: 760,
    totalDistillers: 90,
  },
  {
    id: 9405,
    name: "India",
    slug: "india",
    description:
      "Warm maturation conditions produce bold single malts at a fast pace.",
    summary: "Rich single malts shaped by a warm climate.",
    location: [78.9, 20.6],
    totalBottles: 420,
    totalDistillers: 35,
  },
];

export const mockRegion = {
  id: 9501,
  name: "Islay",
  slug: "islay",
  country: mockCountry,
  description: "An island region known for smoky single malt whisky.",
  location: [-6.2, 55.8],
  totalBottles: 680,
  totalDistillers: 10,
} satisfies Region;

export const mockRegions: Region[] = [
  mockRegion,
  {
    id: 9502,
    name: "Speyside",
    slug: "speyside",
    country: mockCountry,
    description:
      "A dense center of Scotch whisky production known for fruit-forward single malts.",
    location: [-3.3, 57.5],
    totalBottles: 2500,
    totalDistillers: 50,
  },
  {
    id: 9503,
    name: "Highlands",
    slug: "highlands",
    country: mockCountry,
    description:
      "A broad Scotch whisky region with coastal, fruity, and rich styles.",
    location: [-4.7, 57.1],
    totalBottles: 2200,
    totalDistillers: 47,
  },
  {
    id: 9504,
    name: "Campbeltown",
    slug: "campbeltown",
    country: mockCountry,
    description:
      "A small coastal Scotch whisky region known for oily and lightly smoky malts.",
    location: [-5.6, 55.4],
    totalBottles: 310,
    totalDistillers: 3,
  },
  {
    id: 9505,
    name: "Kentucky",
    slug: "kentucky",
    country: mockCountries[2],
    description:
      "The center of American bourbon production, with limestone water and hot summers.",
    location: [-84.9, 37.8],
    totalBottles: 3400,
    totalDistillers: 130,
  },
];

// Producers and bottles
export const mockEntity = {
  id: 9201,
  peatedId: "E9201",
  name: "Lagavulin",
  shortName: null,
  type: ["brand", "distiller"],
  kind: "distillery",
  ownerId: null,
  description: "An Islay distillery known for heavily peated single malt.",
  descriptionSrc: "user",
  yearEstablished: 1816,
  website: "https://www.malts.com/en-row/distilleries/lagavulin",
  country: mockCountry,
  region: mockRegion,
  address: null,
  location: null,
  totalTastings: 1200,
  totalBottles: 84,
  createdAt: timestamp,
  updatedAt: timestamp,
} satisfies Entity;

export const mockEntities: Entity[] = [
  mockEntity,
  {
    ...mockEntity,
    id: 9202,
    peatedId: "E9202",
    name: "The Macallan",
    shortName: "Macallan",
    description:
      "A Speyside distillery known for sherry-seasoned oak maturation.",
    yearEstablished: 1824,
    website: "https://www.themacallan.com",
    region: mockRegions[1],
    totalTastings: 2100,
    totalBottles: 190,
  },
  {
    ...mockEntity,
    id: 9203,
    peatedId: "E9203",
    name: "Springbank",
    shortName: null,
    description:
      "A Campbeltown distillery that malts, distills, matures, and bottles whisky on site.",
    yearEstablished: 1828,
    website: "https://www.springbank.scot",
    region: mockRegions[3],
    totalTastings: 980,
    totalBottles: 120,
  },
  {
    ...mockEntity,
    id: 9204,
    peatedId: "E9204",
    name: "Buffalo Trace",
    shortName: null,
    description: "A Kentucky distillery that produces bourbon and rye whiskey.",
    yearEstablished: 1775,
    website: "https://www.buffalotracedistillery.com",
    country: mockCountries[2],
    region: mockRegions[4],
    totalTastings: 1750,
    totalBottles: 95,
  },
  {
    ...mockEntity,
    id: 9205,
    peatedId: "E9205",
    name: "Yamazaki",
    shortName: null,
    description: "Japan's first malt whisky distillery, founded near Kyoto.",
    yearEstablished: 1923,
    website: "https://house.suntory.com/yamazaki-whisky",
    country: mockCountries[3],
    region: null,
    totalTastings: 1300,
    totalBottles: 72,
  },
  {
    ...mockEntity,
    id: 9206,
    peatedId: "E9206",
    name: "Midleton",
    shortName: null,
    type: ["distiller"],
    description:
      "An Irish distillery that produces pot still and grain whiskey.",
    yearEstablished: 1975,
    website: "https://www.midletondistillerycollection.com",
    country: mockCountries[1],
    region: null,
    totalTastings: 1500,
    totalBottles: 160,
  },
  {
    ...mockEntity,
    id: 9207,
    peatedId: "E9207",
    name: "Redbreast",
    shortName: null,
    type: ["brand"],
    kind: "brand",
    description: "A range of Irish single pot still whiskey made at Midleton.",
    yearEstablished: 1903,
    website: "https://www.redbreastwhiskey.com",
    country: mockCountries[1],
    region: null,
    totalTastings: 1100,
    totalBottles: 34,
  },
  {
    ...mockEntity,
    id: 9208,
    peatedId: "E9208",
    name: "Gordon & MacPhail",
    shortName: "G&M",
    type: ["bottler"],
    kind: "bottler",
    description:
      "An independent Scotch whisky bottler and maturation specialist.",
    yearEstablished: 1895,
    website: "https://www.gordonandmacphail.com",
    region: mockRegions[1],
    totalTastings: 760,
    totalBottles: 1400,
  },
  {
    ...mockEntity,
    id: 9209,
    peatedId: "E9209",
    name: "Compass Box",
    shortName: null,
    type: ["brand", "bottler"],
    kind: "blender",
    description: "A Scotch whisky blending house founded in London.",
    yearEstablished: 2000,
    website: "https://www.compassboxwhisky.com",
    region: null,
    totalTastings: 890,
    totalBottles: 75,
  },
  {
    ...mockEntity,
    id: 9210,
    peatedId: "E9210",
    name: "Diageo",
    shortName: null,
    type: [],
    kind: "company",
    description: "A global drinks company that owns several whisky brands.",
    yearEstablished: 1997,
    website: "https://www.diageo.com",
    region: null,
    totalTastings: 5200,
    totalBottles: 620,
  },
];

export const mockMacallanEntity = mockEntities[1]!;
export const mockSpringbankEntity = mockEntities[2]!;
export const mockBuffaloTraceEntity = mockEntities[3]!;
export const mockYamazakiEntity = mockEntities[4]!;
export const mockMidletonEntity = mockEntities[5]!;
export const mockRedbreastEntity = mockEntities[6]!;

export const mockBottle = {
  id: 9301,
  peatedId: "B9301",
  fullName: "Lagavulin 16-year-old",
  name: "16-year-old",
  series: null,
  category: "single_malt",
  edition: null,
  statedAge: 16,
  noAgeStatement: false,
  caskStrength: false,
  singleCask: false,
  naturalColor: null,
  nonChillFiltered: null,
  maltPhenolPpm: null,
  abv: 43,
  vintageYear: null,
  bottlingYear: null,
  releaseYear: null,
  releaseDate: null,
  maturation: null,
  caskNumber: null,
  outturn: null,
  brand: mockEntity,
  distillers: [mockEntity],
  bottler: null,
  description: "A rich, smoky Islay single malt with a long finish.",
  descriptionSrc: "user",
  imageUrl: null,
  flavorProfile: "peated",
  tastingNotes: {
    nose: "Smoke and dried fruit",
    palate: "Rich malt and sea salt",
    finish: "Long and smoky",
  },
  suggestedTags: ["smoke", "sea salt", "dried fruit"],
  avgRating: 1.6,
  avgScore: 89,
  totalScores: 24,
  ratingStats: {
    pass: 2,
    sip: 18,
    savor: 60,
    total: 80,
    avg: 1.7,
    percentage: {
      pass: 2.5,
      sip: 22.5,
      savor: 75,
    },
  },
  totalTastings: 120,
  createdAt: timestamp,
  updatedAt: timestamp,
  isFavorite: false,
  isLibrary: false,
  hasTasted: false,
} satisfies Bottle;

function ratingStats(pass: number, sip: number, savor: number) {
  const total = pass + sip + savor;
  const percentage = (count: number) =>
    Number(((count / total) * 100).toFixed(1));

  return {
    pass,
    sip,
    savor,
    total,
    avg: Number(((-pass + sip + savor * 2) / total).toFixed(1)),
    percentage: {
      pass: percentage(pass),
      sip: percentage(sip),
      savor: percentage(savor),
    },
  } satisfies Bottle["ratingStats"];
}

export const mockBottles: Bottle[] = [
  mockBottle,
  {
    ...mockBottle,
    id: 9302,
    peatedId: "B9302",
    fullName: "The Macallan 12-year-old Sherry Oak",
    name: "12-year-old Sherry Oak",
    category: "single_malt",
    statedAge: 12,
    abv: 43,
    brand: mockMacallanEntity,
    distillers: [mockMacallanEntity],
    description: "A Speyside single malt matured in sherry-seasoned oak casks.",
    flavorProfile: "deep_rich_dried_fruit",
    tastingNotes: {
      nose: "Dried fruit, vanilla, and ginger",
      palate: "Raisins, oak spice, and orange peel",
      finish: "Long, sweet, and gently spiced",
    },
    suggestedTags: ["raisin", "orange peel", "oak", "ginger"],
    avgRating: 1.5,
    avgScore: 87,
    totalScores: 36,
    ratingStats: ratingStats(5, 30, 65),
    totalTastings: 180,
    createdAt: "2026-08-24T10:30:00.000Z",
    updatedAt: "2026-08-25T18:10:00.000Z",
  },
  {
    ...mockBottle,
    id: 9303,
    peatedId: "B9303",
    fullName: "Springbank 10-year-old",
    name: "10-year-old",
    statedAge: 10,
    naturalColor: true,
    nonChillFiltered: true,
    abv: 46,
    brand: mockSpringbankEntity,
    distillers: [mockSpringbankEntity],
    description:
      "A lightly peated Campbeltown single malt with coastal and orchard fruit notes.",
    flavorProfile: "oily_coastal",
    tastingNotes: {
      nose: "Pear, brine, and light peat",
      palate: "Malt, citrus, mineral oil, and pepper",
      finish: "Dry, coastal, and lightly smoky",
    },
    suggestedTags: ["brine", "pear", "mineral", "light smoke"],
    avgRating: 1.6,
    avgScore: 90,
    totalScores: 31,
    ratingStats: ratingStats(3, 20, 47),
    totalTastings: 142,
    createdAt: "2026-08-21T09:00:00.000Z",
    updatedAt: "2026-08-23T16:45:00.000Z",
  },
  {
    ...mockBottle,
    id: 9304,
    peatedId: "B9304",
    fullName: "Buffalo Trace Kentucky Straight Bourbon",
    name: "Kentucky Straight Bourbon",
    category: "bourbon",
    statedAge: null,
    noAgeStatement: true,
    abv: 45,
    brand: mockBuffaloTraceEntity,
    distillers: [mockBuffaloTraceEntity],
    description:
      "A Kentucky straight bourbon with caramel, vanilla, and baking spice.",
    flavorProfile: "juicy_oak_vanilla",
    tastingNotes: {
      nose: "Caramel, vanilla, and mint",
      palate: "Brown sugar, oak, and baking spice",
      finish: "Medium, sweet, and gently dry",
    },
    suggestedTags: ["caramel", "vanilla", "oak", "cinnamon"],
    avgRating: 1.2,
    avgScore: 84,
    totalScores: 44,
    ratingStats: ratingStats(10, 55, 35),
    totalTastings: 230,
    createdAt: "2026-08-18T14:20:00.000Z",
    updatedAt: "2026-08-22T11:05:00.000Z",
  },
  {
    ...mockBottle,
    id: 9305,
    peatedId: "B9305",
    fullName: "Yamazaki 12-year-old",
    name: "12-year-old",
    statedAge: 12,
    abv: 43,
    brand: mockYamazakiEntity,
    distillers: [mockYamazakiEntity],
    description:
      "A Japanese single malt with orchard fruit, incense, and gentle oak.",
    flavorProfile: "light_delicate",
    tastingNotes: {
      nose: "Peach, pineapple, and clove",
      palate: "Coconut, cranberry, and soft oak",
      finish: "Long, fruity, and lightly spicy",
    },
    suggestedTags: ["peach", "incense", "coconut", "soft oak"],
    avgRating: 1.6,
    avgScore: 91,
    totalScores: 28,
    ratingStats: ratingStats(4, 24, 52),
    totalTastings: 155,
    createdAt: "2026-08-15T08:15:00.000Z",
    updatedAt: "2026-08-20T19:30:00.000Z",
  },
  {
    ...mockBottle,
    id: 9306,
    peatedId: "B9306",
    fullName: "Redbreast 12-year-old",
    name: "12-year-old",
    category: "single_pot_still",
    statedAge: 12,
    abv: 40,
    brand: mockRedbreastEntity,
    distillers: [mockMidletonEntity],
    description:
      "An Irish single pot still whiskey with orchard fruit and toasted spice.",
    flavorProfile: "spicy_sweet",
    tastingNotes: {
      nose: "Apple, toasted nuts, and honey",
      palate: "Dried fruit, baking spice, and vanilla",
      finish: "Rich, warming, and softly sweet",
    },
    suggestedTags: ["apple", "walnut", "honey", "allspice"],
    avgRating: 1.6,
    avgScore: 89,
    totalScores: 26,
    ratingStats: ratingStats(2, 18, 40),
    totalTastings: 168,
    createdAt: "2026-08-12T17:40:00.000Z",
    updatedAt: "2026-08-19T12:00:00.000Z",
  },
  {
    ...mockBottle,
    id: 9307,
    peatedId: "B9307",
    fullName: "Lagavulin 8-year-old",
    name: "8-year-old",
    statedAge: 8,
    abv: 48,
    description:
      "A younger Lagavulin with bright citrus, dry smoke, and maritime notes.",
    flavorProfile: "heavily_peated",
    tastingNotes: {
      nose: "Lemon peel, ash, and sea air",
      palate: "Dry smoke, pepper, and malt",
      finish: "Clean, smoky, and mineral",
    },
    suggestedTags: ["ash", "lemon", "pepper", "sea air"],
    avgRating: 1.4,
    avgScore: 86,
    totalScores: 17,
    ratingStats: ratingStats(4, 25, 41),
    totalTastings: 92,
    createdAt: "2026-08-09T13:25:00.000Z",
    updatedAt: "2026-08-17T09:40:00.000Z",
  },
  {
    ...mockBottle,
    id: 9308,
    peatedId: "B9308",
    fullName: "Lagavulin Offerman Edition 11-year-old Charred Oak Cask",
    name: "Offerman Edition 11-year-old Charred Oak Cask",
    edition: "Charred Oak Cask",
    statedAge: 11,
    abv: 46,
    description:
      "A limited Lagavulin edition finished with charred oak influence.",
    flavorProfile: "peated",
    tastingNotes: {
      nose: "Campfire smoke, vanilla, and red fruit",
      palate: "Charred oak, dark chocolate, and spice",
      finish: "Smoky, sweet, and warming",
    },
    suggestedTags: ["charred oak", "vanilla", "dark chocolate", "smoke"],
    avgRating: 1.5,
    avgScore: 88,
    totalScores: 12,
    ratingStats: ratingStats(3, 17, 30),
    totalTastings: 64,
    createdAt: "2026-08-06T11:10:00.000Z",
    updatedAt: "2026-08-16T15:20:00.000Z",
  },
];

const favoriteBottleIds = new Set([9301, 9305]);
const libraryBottleIds = new Set([9301, 9303, 9306]);
const tastedBottleIds = new Set([9301, 9302, 9303, 9304]);

export function mockBottleFor(
  user: User | null,
  bottle: Bottle = mockBottle,
): Bottle {
  return user
    ? {
        ...bottle,
        isFavorite: favoriteBottleIds.has(bottle.id),
        isLibrary: libraryBottleIds.has(bottle.id),
        hasTasted: tastedBottleIds.has(bottle.id),
      }
    : bottle;
}

export const mockBottleDetails = {
  ...mockBottle,
  barcodes: [{ value: "5000281016290", volume: 700 }],
  people: 96,
  lastPrice: null,
} satisfies MockOutputs["bottles"]["details"];

export const mockBottleDetailsList = mockBottles.map(
  (bottle, index) =>
    ({
      ...bottle,
      barcodes: index === 0 ? mockBottleDetails.barcodes : [],
      people: Math.max(24, Math.round(bottle.totalTastings * 0.8)),
      lastPrice: null,
    }) satisfies BottleDetails,
);

export function mockBottleDetailsFor(
  user: User | null,
  bottle: BottleDetails = mockBottleDetails,
): MockOutputs["bottles"]["details"] {
  return {
    ...bottle,
    ...mockBottleFor(user, bottle),
  };
}

export const mockBottleTags = {
  results: [
    { tag: "smoke", count: 48 },
    { tag: "sea salt", count: 31 },
    { tag: "dried fruit", count: 22 },
  ],
  totalCount: 120,
} satisfies MockOutputs["bottles"]["tags"];

export function mockBottleTagsFor(
  bottle: Bottle,
): MockOutputs["bottles"]["tags"] {
  if (bottle.id === mockBottle.id) return mockBottleTags;

  return {
    results: (bottle.suggestedTags ?? []).map((tag, index) => ({
      tag,
      count: Math.max(4, Math.round(bottle.totalTastings / (index + 3))),
    })),
    totalCount: bottle.totalTastings,
  };
}

export const mockEntityCatalog = {
  totalBottles: mockEntity.totalBottles,
  relationships: {
    brand: mockEntity.totalBottles,
    bottler: 0,
    distiller: mockEntity.totalBottles,
  },
  distilleryCoverage: {
    documented: mockEntity.totalBottles,
    total: mockEntity.totalBottles,
  },
  categories: [{ category: "single_malt", count: mockEntity.totalBottles }],
  related: {
    brands: [],
    bottlers: [],
    distillers: [],
  },
  notableBottles: [
    {
      id: mockBottle.id,
      fullName: mockBottle.fullName,
      totalTastings: mockBottle.totalTastings,
      avgRating: mockBottle.avgRating,
    },
  ],
} satisfies MockOutputs["entities"]["catalog"];

export function mockEntityCatalogFor(
  entity: Entity,
): MockOutputs["entities"]["catalog"] {
  if (entity.id === mockEntity.id) {
    const lagavulinBottles = mockBottles.filter(
      (bottle) => bottle.brand.id === entity.id,
    );
    return {
      ...mockEntityCatalog,
      notableBottles: lagavulinBottles.map((bottle) => ({
        id: bottle.id,
        fullName: bottle.fullName,
        totalTastings: bottle.totalTastings,
        avgRating: bottle.avgRating,
      })),
    };
  }

  const relatedBottles = mockBottles.filter(
    (bottle) =>
      bottle.brand.id === entity.id ||
      bottle.bottler?.id === entity.id ||
      bottle.distillers.some((distiller) => distiller.id === entity.id),
  );
  const categoryCounts = new Map<Bottle["category"], number>();
  for (const bottle of relatedBottles) {
    categoryCounts.set(
      bottle.category,
      (categoryCounts.get(bottle.category) ?? 0) + 1,
    );
  }
  const relatedEntities = (
    values: Entity[],
  ): MockOutputs["entities"]["catalog"]["related"]["brands"] =>
    values
      .filter(
        (value, index) =>
          value.id !== entity.id &&
          values.findIndex((candidate) => candidate.id === value.id) === index,
      )
      .map((value) => ({
        id: value.id,
        name: value.name,
        shortName: value.shortName,
        count: relatedBottles.filter(
          (bottle) =>
            bottle.brand.id === value.id ||
            bottle.bottler?.id === value.id ||
            bottle.distillers.some((distiller) => distiller.id === value.id),
        ).length,
      }));

  return {
    totalBottles: entity.totalBottles,
    relationships: {
      brand: entity.type.includes("brand") ? entity.totalBottles : 0,
      bottler: entity.type.includes("bottler") ? entity.totalBottles : 0,
      distiller: entity.type.includes("distiller") ? entity.totalBottles : 0,
    },
    distilleryCoverage: {
      documented:
        entity.type.includes("distiller") ||
        relatedBottles.some((bottle) => bottle.distillers.length > 0)
          ? entity.totalBottles
          : 0,
      total: entity.totalBottles,
    },
    categories: [...categoryCounts].map(([category, count]) => ({
      category,
      count: Math.round(
        entity.totalBottles * (count / Math.max(relatedBottles.length, 1)),
      ),
    })),
    related: {
      brands: relatedEntities(relatedBottles.map((bottle) => bottle.brand)),
      bottlers: relatedEntities(
        relatedBottles.flatMap((bottle) =>
          bottle.bottler ? [bottle.bottler] : [],
        ),
      ),
      distillers: relatedEntities(
        relatedBottles.flatMap((bottle) => bottle.distillers),
      ),
    },
    notableBottles: relatedBottles.map((bottle) => ({
      id: bottle.id,
      fullName: bottle.fullName,
      totalTastings: bottle.totalTastings,
      avgRating: bottle.avgRating,
    })),
  };
}

// Reviews, comments, and profile insights
export const mockReview = {
  id: 9801,
  name: mockBottle.fullName,
  rating: 92,
  url: "https://example.com/reviews/lagavulin-16",
  site: {
    id: 9802,
    type: "whiskyadvocate",
    name: "Whisky Advocate",
    lastRunAt: timestamp,
    nextRunAt: null,
    runEvery: null,
  },
  article: {
    title: "Lagavulin 16 Review",
    publishedAt: timestamp,
  },
  reviewerName: "Mock Reviewer",
  nativeScore: {
    value: 92,
    scale: 100,
    display: "92",
  },
  summary: "Rich smoke, dried fruit, and maritime notes.",
  bottle: mockBottle,
  createdAt: timestamp,
  updatedAt: timestamp,
} satisfies Review;

export const mockReviews = [
  mockReview,
  {
    ...mockReview,
    id: 9810,
    rating: 88,
    url: "https://example.com/reviews/lagavulin-8",
    site: {
      ...mockReview.site!,
      id: 9811,
      type: "whiskyfun",
      name: "Whiskyfun",
      runEvery: 1440,
    },
    article: {
      title: "Lagavulin 8-year-old",
      publishedAt: "2026-08-20T09:00:00.000Z",
    },
    reviewerName: "Serge Sample",
    nativeScore: { value: 88, scale: 100, display: "88 points" },
    summary: "Bright citrus and dry peat make this younger release lively.",
    bottle: mockBottles[6],
    createdAt: "2026-08-20T10:00:00.000Z",
    updatedAt: "2026-08-20T10:00:00.000Z",
  },
  {
    ...mockReview,
    id: 9812,
    name: mockBottles[1]!.fullName,
    rating: 87,
    url: "https://example.com/reviews/macallan-12-sherry-oak",
    site: {
      ...mockReview.site!,
      id: 9813,
      type: "whiskynotes",
      name: "WhiskyNotes",
      runEvery: 1440,
    },
    article: {
      title: "Macallan 12 Sherry Oak Review",
      publishedAt: "2026-08-18T14:00:00.000Z",
    },
    reviewerName: "Ruben Sample",
    nativeScore: { value: 87, scale: 100, display: "87/100" },
    summary: "Classic dried fruit and orange peel with polished oak.",
    bottle: mockBottles[1],
    createdAt: "2026-08-18T15:00:00.000Z",
    updatedAt: "2026-08-18T15:00:00.000Z",
  },
  {
    ...mockReview,
    id: 9814,
    name: mockBottles[3]!.fullName,
    rating: 84,
    url: "https://example.com/reviews/buffalo-trace-bourbon",
    site: {
      ...mockReview.site!,
      id: 9815,
      type: "bourbonculture",
      name: "Bourbon Culture",
      runEvery: 1440,
    },
    article: {
      title: "Buffalo Trace Bourbon Review",
      publishedAt: "2026-08-15T16:00:00.000Z",
    },
    reviewerName: "Bourbon Sample",
    nativeScore: { value: 84, scale: 100, display: "84" },
    summary: "An approachable bourbon with caramel, vanilla, and mild oak.",
    bottle: mockBottles[3],
    createdAt: "2026-08-15T17:00:00.000Z",
    updatedAt: "2026-08-15T17:00:00.000Z",
  },
  {
    ...mockReview,
    id: 9816,
    name: mockBottles[4]!.fullName,
    rating: 91,
    url: "https://example.com/reviews/yamazaki-12",
    article: {
      title: "Yamazaki 12-year-old Review",
      publishedAt: "2026-08-12T11:00:00.000Z",
    },
    reviewerName: "Editorial Sample",
    site: undefined,
    nativeScore: { value: 91, scale: 100, display: "91" },
    summary: "Layered orchard fruit, incense, and restrained oak.",
    bottle: mockBottles[4],
    createdAt: "2026-08-12T12:00:00.000Z",
    updatedAt: "2026-08-12T12:00:00.000Z",
  },
  {
    ...mockReview,
    id: 9817,
    name: "Mystery Islay Malt 18-year-old",
    rating: 90,
    url: "https://example.com/reviews/mystery-islay-18",
    article: {
      title: "Mystery Islay Malt Review",
      publishedAt: "2026-08-10T12:00:00.000Z",
    },
    reviewerName: "Editorial Sample",
    site: undefined,
    nativeScore: { value: 90, scale: 100, display: "90" },
    summary: "A mature smoky malt that has not yet been matched to a bottle.",
    bottle: null,
    createdAt: "2026-08-10T13:00:00.000Z",
    updatedAt: "2026-08-10T13:00:00.000Z",
  },
  {
    ...mockReview,
    id: 9818,
    rating: 89,
    url: "https://example.com/reviews/lagavulin-16-dramface",
    site: {
      ...mockReview.site!,
      id: 9819,
      type: "dramface",
      name: "Dramface",
      runEvery: 1440,
    },
    article: {
      title: "Lagavulin 16: The Islay Benchmark",
      publishedAt: "2026-08-08T12:00:00.000Z",
    },
    reviewerName: "Dramface Sample",
    nativeScore: { value: 8.9, scale: 10, display: "8.9/10" },
    summary: "Balanced peat, fruit, and oak with an easy maritime character.",
    createdAt: "2026-08-08T13:00:00.000Z",
    updatedAt: "2026-08-08T13:00:00.000Z",
  },
  {
    ...mockReview,
    id: 9830,
    rating: 90,
    url: "https://example.com/reviews/lagavulin-16-words",
    site: {
      ...mockReview.site!,
      id: 9831,
      type: "wordsofwhisky",
      name: "Words of Whisky",
      runEvery: 1440,
    },
    article: {
      title: "Revisiting Lagavulin 16-year-old",
      publishedAt: "2026-08-05T12:00:00.000Z",
    },
    reviewerName: "Words Sample",
    nativeScore: { value: 90, scale: 100, display: "90 points" },
    summary: "Mature smoke, dried fruit, and sea salt remain well integrated.",
    createdAt: "2026-08-05T13:00:00.000Z",
    updatedAt: "2026-08-05T13:00:00.000Z",
  },
] satisfies Review[];

export const mockComment = {
  id: 9803,
  comment: "The smoke opens up after a few minutes in the glass.",
  createdAt: timestamp,
  createdBy: mockPublicUser,
} satisfies Comment;

export const mockComments = [
  mockComment,
  {
    id: 9820,
    comment: "I get grilled pineapple behind the peat on this one.",
    createdAt: "2026-08-25T18:20:00.000Z",
    createdBy: mockFriends[0]!,
  },
  {
    id: 9821,
    comment: "A small splash of water brings out more citrus.",
    createdAt: "2026-08-25T18:35:00.000Z",
    createdBy: mockFriends[1]!,
  },
  {
    id: 9822,
    comment: "The sherry oak feels drier than I expected.",
    createdAt: "2026-08-22T20:15:00.000Z",
    createdBy: mockPublicUser,
  },
  {
    id: 9823,
    comment: "Great contrast between the caramel and mint notes.",
    createdAt: "2026-08-19T19:45:00.000Z",
    createdBy: mockFriends[0]!,
  },
] satisfies Comment[];

export const mockCommentsByTasting = new Map<number, Comment[]>([
  [9601, mockComments.slice(0, 3)],
  [9602, [mockComments[3]!]],
  [9604, [mockComments[4]!]],
]);

export const mockBadgeAward = {
  id: 9804,
  xp: 12,
  level: 2,
  badge: {
    id: 9805,
    name: "Islay Explorer",
    maxLevel: 25,
    imageUrl: null,
  },
  createdAt: timestamp,
} satisfies BadgeAward;

export const mockBadgeAwards = [
  mockBadgeAward,
  {
    id: 9824,
    xp: 25,
    level: 5,
    badge: {
      id: 9825,
      name: "World Tour",
      maxLevel: 25,
      imageUrl: null,
    },
    createdAt: "2026-08-10T12:00:00.000Z",
    prevLevel: 4,
  },
  {
    id: 9826,
    xp: 8,
    level: 1,
    badge: {
      id: 9827,
      name: "Bourbon Trail",
      maxLevel: 25,
      imageUrl: null,
    },
    createdAt: "2026-07-28T12:00:00.000Z",
  },
  {
    id: 9828,
    xp: 40,
    level: 8,
    badge: {
      id: 9829,
      name: "Tasting Streak",
      maxLevel: 25,
      imageUrl: null,
    },
    createdAt: "2026-07-12T12:00:00.000Z",
    prevLevel: 7,
  },
] satisfies BadgeAward[];

export const mockUserRegionList = {
  results: [
    {
      country: { name: mockCountry.name, slug: mockCountry.slug },
      region: { name: mockRegion.name, slug: mockRegion.slug },
      count: 15,
    },
    {
      country: { name: mockCountry.name, slug: mockCountry.slug },
      region: {
        name: mockRegions[1]!.name,
        slug: mockRegions[1]!.slug,
      },
      count: 8,
    },
    {
      country: { name: mockCountry.name, slug: mockCountry.slug },
      region: {
        name: mockRegions[3]!.name,
        slug: mockRegions[3]!.slug,
      },
      count: 6,
    },
    {
      country: {
        name: mockCountries[2]!.name,
        slug: mockCountries[2]!.slug,
      },
      region: {
        name: mockRegions[4]!.name,
        slug: mockRegions[4]!.slug,
      },
      count: 7,
    },
    {
      country: {
        name: mockCountries[3]!.name,
        slug: mockCountries[3]!.slug,
      },
      region: null,
      count: 4,
    },
  ],
  totalCount: 42,
} satisfies MockOutputs["users"]["regionList"];

export const mockUserFlavorList = {
  results: [
    { flavorProfile: "peated", count: 11, score: 19 },
    { flavorProfile: "deep_rich_dried_fruit", count: 8, score: 13 },
    { flavorProfile: "oily_coastal", count: 6, score: 11 },
    { flavorProfile: "juicy_oak_vanilla", count: 6, score: 7 },
    { flavorProfile: "spicy_sweet", count: 5, score: 7 },
    { flavorProfile: "light_delicate", count: 3, score: 4 },
  ],
  totalScore: 61,
  totalCount: 42,
} satisfies MockOutputs["users"]["flavorList"];

export const mockAgeStats = {
  knownCount: 36,
  median: 16,
  oldest: 25,
  buckets: [
    { id: "under10", label: "Under 10", count: 4 },
    { id: "from10To12", label: "10–12", count: 8 },
    { id: "from13To17", label: "13–17", count: 18 },
    { id: "from18To24", label: "18–24", count: 4 },
    { id: "atLeast25", label: "25+", count: 2 },
    { id: "unstated", label: "Unstated", count: 6 },
  ],
} satisfies MockOutputs["users"]["tastingStats"]["age"];

export const mockUserTastingStats = {
  total: 42,
  uniqueBottles: 31,
  ratings: {
    total: 42,
    pass: 2,
    sip: 15,
    savor: 25,
  },
  mostTastedBottle: {
    id: mockBottle.id,
    name: mockBottle.fullName,
    count: 3,
  },
  age: mockAgeStats,
} satisfies MockOutputs["users"]["tastingStats"];

export const mockUserLibraryStats = {
  total: 12,
  status: {
    open: 4,
    sealed: 8,
    unspecified: 0,
  },
  brands: [
    { id: mockEntity.id, name: mockEntity.name, count: 3 },
    { id: mockMacallanEntity.id, name: mockMacallanEntity.name, count: 2 },
    {
      id: mockSpringbankEntity.id,
      name: mockSpringbankEntity.name,
      count: 2,
    },
    {
      id: mockRedbreastEntity.id,
      name: mockRedbreastEntity.name,
      count: 2,
    },
    {
      id: mockBuffaloTraceEntity.id,
      name: mockBuffaloTraceEntity.name,
      count: 1,
    },
    { id: mockYamazakiEntity.id, name: mockYamazakiEntity.name, count: 2 },
  ],
  distillers: [
    { id: mockEntity.id, name: mockEntity.name, count: 3 },
    { id: mockMacallanEntity.id, name: mockMacallanEntity.name, count: 2 },
    {
      id: mockSpringbankEntity.id,
      name: mockSpringbankEntity.name,
      count: 2,
    },
    { id: mockMidletonEntity.id, name: mockMidletonEntity.name, count: 2 },
    {
      id: mockBuffaloTraceEntity.id,
      name: mockBuffaloTraceEntity.name,
      count: 1,
    },
    { id: mockYamazakiEntity.id, name: mockYamazakiEntity.name, count: 2 },
  ],
  age: {
    ...mockAgeStats,
    knownCount: 12,
    buckets: [
      { id: "under10", label: "Under 10", count: 0 },
      { id: "from10To12", label: "10–12", count: 0 },
      { id: "from13To17", label: "13–17", count: 12 },
      { id: "from18To24", label: "18–24", count: 0 },
      { id: "atLeast25", label: "25+", count: 0 },
      { id: "unstated", label: "Unstated", count: 0 },
    ],
  },
  categories: [
    { category: "single_malt", count: 8 },
    { category: "single_pot_still", count: 2 },
    { category: "bourbon", count: 1 },
    { category: "blend", count: 1 },
  ],
} satisfies MockOutputs["users"]["libraryStats"];

// Flights, tastings, and collections
export const mockFlight = {
  id: "mock-islay-flight",
  name: "Islay Smoke",
  description: "A side-by-side tasting of smoky Islay whisky.",
  public: true,
  createdAt: timestamp,
  createdBy: mockPublicUser,
} satisfies Flight;

export const mockFlights = [
  mockFlight,
  {
    id: "mock-world-flight",
    name: "Whisky Around the World",
    description:
      "Compare Scotch, bourbon, Japanese whisky, and Irish pot still whiskey.",
    public: true,
    createdAt: "2026-08-18T12:00:00.000Z",
    createdBy: mockFriends[0],
  },
  {
    id: "mock-sherry-flight",
    name: "Fruit and Sherry",
    description: "Rich whiskies with dried fruit and cask spice.",
    public: true,
    createdAt: "2026-08-12T12:00:00.000Z",
    createdBy: mockFriends[1],
  },
  {
    id: "mock-cabinet-flight",
    name: "Open Cabinet",
    description: "A private flight from the signed-in user's open bottles.",
    public: false,
    createdAt: "2026-08-08T12:00:00.000Z",
    createdBy: mockPublicUser,
  },
] satisfies Flight[];

export const mockFlightBottleIds = new Map<string, number[]>([
  [mockFlight.id, [9301, 9307, 9308]],
  ["mock-world-flight", [9302, 9304, 9305, 9306]],
  ["mock-sherry-flight", [9302, 9306]],
  ["mock-cabinet-flight", [9301, 9303, 9306]],
]);

export function mockFlightDetailsFor(
  user: User | null,
  flight: Flight = mockFlight,
): MockOutputs["flights"]["details"] {
  const bottles = (mockFlightBottleIds.get(flight.id) ?? []).flatMap((id) => {
    const bottle = mockBottles.find((candidate) => candidate.id === id);
    return bottle ? [mockBottleFor(user, bottle)] : [];
  });

  return {
    ...flight,
    bottles: bottles.map((bottle) => ({
      bottle,
      hasTasted: bottle.hasTasted,
      isLibrary: bottle.isLibrary,
    })),
  };
}

export const mockTasting = {
  id: 9601,
  imageUrl: null,
  notes: "Smoke, dried fruit, sea salt, and a long finish.",
  bottle: mockBottle,
  rating: 2,
  score: null,
  tags: ["smoke", "dried fruit", "sea salt"],
  color: 14,
  servingStyle: "neat",
  friends: [],
  awards: [],
  comments: 2,
  toasts: 5,
  hasToasted: false,
  createdAt: timestamp,
  createdBy: mockPublicUser,
} satisfies Tasting;

export const mockTastings = [
  mockTasting,
  {
    ...mockTasting,
    id: 9602,
    notes:
      "Dried apricot, orange peel, and ginger. The oak turns pleasantly dry.",
    bottle: mockBottles[1]!,
    rating: 1,
    tags: ["dried fruit", "orange peel", "ginger", "oak"],
    color: 16,
    servingStyle: "splash",
    friends: [mockFriends[0]!],
    comments: 1,
    toasts: 3,
    createdAt: "2026-08-22T20:00:00.000Z",
  },
  {
    ...mockTasting,
    id: 9603,
    notes: "Pear, machine oil, lemon, and a little coastal smoke.",
    bottle: mockBottles[2]!,
    rating: 2,
    tags: ["pear", "mineral", "lemon", "smoke"],
    color: 9,
    servingStyle: "neat",
    friends: [],
    comments: 0,
    toasts: 7,
    createdAt: "2026-08-21T19:10:00.000Z",
    createdBy: mockFriends[0]!,
  },
  {
    ...mockTasting,
    id: 9604,
    notes: "Caramel and vanilla first, then mint and dry oak.",
    bottle: mockBottles[3]!,
    rating: 1,
    tags: ["caramel", "vanilla", "mint", "oak"],
    color: 12,
    servingStyle: "rocks",
    friends: [mockFriends[1]!],
    comments: 1,
    toasts: 2,
    createdAt: "2026-08-19T19:30:00.000Z",
    createdBy: mockFriends[1]!,
  },
  {
    ...mockTasting,
    id: 9605,
    notes: "Peach, incense, and coconut with a very composed finish.",
    bottle: mockBottles[4]!,
    rating: null,
    score: 92,
    tags: ["peach", "incense", "coconut"],
    color: 10,
    servingStyle: "neat",
    friends: [],
    comments: 0,
    toasts: 9,
    createdAt: "2026-08-17T21:00:00.000Z",
    createdBy: mockFriends[0]!,
  },
  {
    ...mockTasting,
    id: 9606,
    notes: "Baked apple, walnut, honey, and a warming pot still spice.",
    bottle: mockBottles[5]!,
    rating: 2,
    score: null,
    tags: ["apple", "walnut", "honey", "allspice"],
    color: 13,
    servingStyle: "splash",
    friends: [mockFriends[0]!, mockFriends[1]!],
    comments: 0,
    toasts: 6,
    createdAt: "2026-08-14T18:00:00.000Z",
  },
] satisfies Tasting[];

export function mockTastingFor(
  user: User | null,
  tasting: Tasting = mockTasting,
): Tasting {
  return {
    ...tasting,
    bottle: mockBottleFor(user, tasting.bottle),
    hasToasted: Boolean(user && tasting.id % 2 === 1),
  };
}

export const mockCollectionBottle = {
  id: 9701,
  imageUrl: null,
  status: "open",
  bottle: mockBottle,
  hasTasted: true,
} satisfies CollectionBottle;

export const mockCollectionBottles = [
  mockCollectionBottle,
  {
    id: 9702,
    imageUrl: null,
    status: "sealed",
    bottle: mockBottles[1]!,
    hasTasted: true,
  },
  {
    id: 9703,
    imageUrl: null,
    status: "open",
    bottle: mockBottles[2]!,
    hasTasted: false,
  },
  {
    id: 9704,
    imageUrl: null,
    status: "empty",
    bottle: mockBottles[3]!,
    hasTasted: true,
  },
  {
    id: 9705,
    imageUrl: null,
    status: "sealed",
    bottle: mockBottles[4]!,
    hasTasted: false,
  },
  {
    id: 9706,
    imageUrl: null,
    status: null,
    bottle: mockBottles[5]!,
    hasTasted: true,
  },
] satisfies CollectionBottle[];

export const mockActivity = [
  {
    id: "tasting-session-9601",
    type: "tasting_session",
    priority: "primary",
    startedAt: "2026-08-26T11:30:00.000Z",
    lastActivityAt: timestamp,
    createdBy: mockPublicUser,
    tastings: [mockTasting, mockTastings[1]!],
  },
  {
    id: "tasting-session-9603",
    type: "tasting_session",
    priority: "primary",
    startedAt: "2026-08-21T19:10:00.000Z",
    lastActivityAt: "2026-08-21T19:10:00.000Z",
    createdBy: mockFriends[0]!,
    tastings: [mockTastings[2]!],
  },
  {
    id: "collection-add-9701",
    type: "collection_add",
    priority: "secondary",
    createdAt: "2026-08-20T17:00:00.000Z",
    windowStart: "2026-08-20T16:30:00.000Z",
    windowEnd: "2026-08-20T17:00:00.000Z",
    createdBy: mockPublicUser,
    collection: {
      id: 9801,
      name: "Islay Favorites",
      totalBottles: 3,
      createdAt: "2026-07-01T12:00:00.000Z",
      createdBy: mockPublicUser,
      href: `/users/${mockPublicUser.username}/collections/9801`,
    },
    items: [
      mockCollectionBottle,
      {
        ...mockCollectionBottles[2]!,
        bottle: mockBottles[6]!,
        status: null,
      },
      {
        ...mockCollectionBottles[4]!,
        bottle: mockBottles[7]!,
        status: null,
      },
    ],
    totalItems: 3,
  },
] satisfies ActivityEntry[];

// List helpers
export function mockPage<T>(items: T[], cursor: number, limit: number) {
  const offset = (cursor - 1) * limit;
  const results = items.slice(offset, offset + limit);

  return {
    results,
    rel: {
      nextCursor: offset + limit < items.length ? cursor + 1 : null,
      prevCursor: cursor > 1 ? cursor - 1 : null,
    },
  };
}

export function includesQuery(query: string, ...values: (string | null)[]) {
  const normalizedQuery = query.trim().toLowerCase();
  return (
    normalizedQuery.length === 0 ||
    values.some((value) => value?.toLowerCase().includes(normalizedQuery))
  );
}
