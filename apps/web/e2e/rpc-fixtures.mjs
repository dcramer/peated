const timestamp = "2026-06-07T12:00:00.000Z";

export const createdBottleName = "Playwright Reserve";
export const tastingNotes = "Smoke, lemon peel, and sea salt.";
export const photoTastingNotes = "Photo flow: smoke, lemon peel, and sea salt.";
export const genericTastingNotes =
  "Release family: smoke, lemon peel, and sea salt.";
export const failingTastingNotes = "Please make this tasting fail.";

export const testUser = {
  id: 9101,
  username: "playwright",
  pictureUrl: null,
  private: false,
  email: "playwright@example.com",
  verified: true,
  admin: false,
  mod: false,
  createdAt: timestamp,
  termsAcceptedAt: timestamp,
  friendStatus: "none",
  stats: {
    tastings: 0,
    bottles: 0,
    collected: 0,
    library: {
      total: 0,
      open: 0,
      sealed: 0,
    },
    contributions: 0,
  },
};

export const emptyLibraryStats = {
  total: 0,
  distillers: [],
  age: {
    knownCount: 0,
    median: null,
    oldest: null,
    buckets: [
      { id: "under10", label: "Under 10", count: 0 },
      { id: "from10To12", label: "10–12", count: 0 },
      { id: "from13To17", label: "13–17", count: 0 },
      { id: "from18To24", label: "18–24", count: 0 },
      { id: "atLeast25", label: "25+", count: 0 },
      { id: "unstated", label: "Unstated", count: 0 },
    ],
  },
  categories: [],
};

export const testAccessToken = "peated-playwright-access-token";

export const testBrand = {
  id: 9201,
  name: "Lagavulin",
  shortName: null,
  type: ["brand", "distiller"],
  description: null,
  descriptionSrc: null,
  yearEstablished: null,
  website: null,
  country: null,
  region: null,
  address: null,
  location: null,
  totalTastings: 0,
  totalBottles: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
};

export const existingBottleId = 9301;
export const createdBottleId = 9302;
export const exactMatchedBottleId = 9305;
export const replacementSourceBottleId = 9307;
export const missingBottleId = 9309;
export const exactMergeOtherBottleId = 9311;
export const exactSearchBottleId = 9312;
export const createdTastingId = 9401;
export const bottleImageBottleId = 9501;
export const bottleImageUrl = "http://127.0.0.1:4999/uploads/bottle-image.webp";

export function buildBottle({
  id = existingBottleId,
  name = "16-year-old",
  brand = testBrand,
  imageUrl = null,
  totalTastings = 0,
  people = 0,
  hasTasted = false,
} = {}) {
  return {
    id,
    fullName: `${brand.name} ${name}`,
    name,
    series: null,
    category: "single_malt",
    edition: null,
    statedAge: null,
    caskStrength: null,
    singleCask: null,
    abv: null,
    vintageYear: null,
    releaseYear: null,
    caskType: null,
    caskSize: null,
    caskFill: null,
    brand,
    distillers: [brand],
    bottler: null,
    description: null,
    descriptionSrc: null,
    imageUrl,
    flavorProfile: null,
    tastingNotes: null,
    suggestedTags: [],
    avgRating: null,
    ratingStats: {
      pass: 0,
      sip: 0,
      savor: 0,
      total: 0,
      avg: null,
      percentage: {
        pass: 0,
        sip: 0,
        savor: 0,
      },
    },
    totalTastings,
    people,
    lastPrice: null,
    createdBy: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    isFavorite: false,
    isLibrary: false,
    hasTasted,
  };
}

const existingBottleWithoutGroup = buildBottle();
export const existingBottle = {
  ...existingBottleWithoutGroup,
  group: buildBottleGroup({ bottle: existingBottleWithoutGroup }),
};

export const exactMergeOtherBottle = {
  ...buildBottle({
    id: exactMergeOtherBottleId,
    name: existingBottle.name,
  }),
  fullName: existingBottle.fullName,
};

export const exactSearchBottle = {
  ...buildBottle({
    id: exactSearchBottleId,
    name: "21-year-old",
  }),
  fullName: `${testBrand.name} 21-year-old - Cask 42`,
  statedAge: 21,
  edition: "Cask 42",
  abv: 55.1,
  vintageYear: 2004,
  releaseYear: 2025,
  singleCask: true,
  caskStrength: true,
  caskFill: "1st_fill",
  caskType: "oloroso",
  caskSize: "hogshead",
};

export const anotherReleaseSourceBottle = {
  ...existingBottle,
  fullName: `${existingBottle.fullName} Distillers Edition`,
  statedAge: 16,
  edition: "Distillers Edition",
  abv: 43,
  releaseYear: 2024,
};

export const addAnotherReleaseSourceBottle = {
  ...anotherReleaseSourceBottle,
  name: `${existingBottle.name} - Distillers Edition - 2024 Release - 43% ABV`,
  fullName: `${existingBottle.fullName} - Distillers Edition - 2024 Release - 43% ABV`,
  group: buildBottleGroup({
    bottle: { ...existingBottle, statedAge: 16 },
  }),
};

export const unifiedBottleEditContext = {
  bottleId: existingBottleId,
  totalBottles: 3,
  shared: {
    name: "18-year-old",
    statedAge: 18,
    brand: { id: testBrand.id, name: testBrand.name },
    distillers: [{ id: testBrand.id, name: testBrand.name }],
    bottler: null,
    series: { id: 9601, name: "Distillers Edition" },
    category: "single_malt",
    flavorProfile: "peated",
  },
  exact: {
    edition: "Cask 42",
    statedAge: 21,
    abv: 55.1,
    singleCask: true,
    caskStrength: true,
    vintageYear: 2004,
    releaseYear: 2023,
    caskSize: "hogshead",
    caskType: "oloroso",
    caskFill: "1st_fill",
    description: "A fixture exact Bottle description.",
    descriptionSrc: null,
    imageUrl: null,
  },
};

export const exactMatchedBottle = {
  ...existingBottle,
  id: exactMatchedBottleId,
  fullName: `${existingBottle.fullName} Distillers Edition`,
  name: "Distillers Edition",
  edition: "Distillers Edition",
  statedAge: existingBottle.statedAge,
  abv: null,
  caskStrength: null,
  singleCask: null,
  vintageYear: null,
  releaseYear: 2024,
  caskType: null,
  caskSize: null,
  caskFill: null,
  suggestedTags: [],
  avgRating: null,
  totalTastings: 0,
  isFavorite: false,
  hasTasted: false,
};

/**
 * @typedef {Omit<ReturnType<typeof buildBottle>, "bottler" | "series"> & {
 *   bottler: {id: number} | null,
 *   series: {id: number} | null
 * }} FixtureBottle
 */
/** @typedef {import("@peated/server/schemas").ConcreteBottleV1} ConcreteBottleV1 */
/**
 * @typedef {Omit<FixtureBottle,
 *   "edition" | "statedAge" | "abv" | "singleCask" | "caskStrength" |
 *   "vintageYear" | "releaseYear" | "caskSize" | "caskType" | "caskFill" |
 *   "imageUrl"
 * > & Pick<ConcreteBottleV1,
 *   "edition" | "statedAge" | "abv" | "singleCask" | "caskStrength" |
 *   "vintageYear" | "releaseYear" | "caskSize" | "caskType" | "caskFill" |
 *   "imageUrl"
 * >} ConcreteFixtureBottle
 */
/** @typedef {import("@peated/server/schemas").BottleGroupV1} BottleGroupV1 */
/** @typedef {import("@peated/server/types").CollectionBottle} CollectionBottle */

/**
 * @typedef {object} BottleGroupFixtureOptions
 * @property {number} [id]
 * @property {string} [fullName]
 * @property {string} [name]
 * @property {FixtureBottle | ConcreteFixtureBottle} [bottle]
 * @property {number | null} [representativeBottleId]
 */

/**
 * @param {BottleGroupFixtureOptions} [options]
 * @returns {BottleGroupV1}
 */
export function buildBottleGroup({
  id,
  fullName,
  name,
  bottle = existingBottle,
  representativeBottleId = bottle.id,
} = {}) {
  return {
    schemaVersion: 1,
    id: id ?? 30_000_000 + bottle.id,
    fullName: fullName ?? bottle.fullName,
    name: name ?? bottle.name,
    brandId: bottle.brand.id,
    bottlerId: bottle.bottler?.id ?? null,
    distillerIds: bottle.distillers.map((distiller) => distiller.id),
    category: /** @type {BottleGroupV1["category"]} */ (bottle.category),
    seriesId: bottle.series?.id ?? null,
    statedAge: bottle.statedAge,
    representativeBottleId,
    flavorProfile: bottle.flavorProfile,
    avgRating: bottle.avgRating,
    ratingStats: bottle.ratingStats,
    totalTastings: bottle.totalTastings,
    totalBottles: 1,
    createdByActorId: testUser.id,
    createdAt: bottle.createdAt,
    updatedAt: bottle.updatedAt,
  };
}

export const bottleGroupId = 50_001;
export const destinationBottleGroupId = 50_002;

const bottleGroupRatingStats = {
  pass: 2,
  sip: 3,
  savor: 4,
  total: 9,
  avg: 2.2,
  percentage: {
    pass: 22.2,
    sip: 33.3,
    savor: 44.5,
  },
};

/** @type {ConcreteFixtureBottle} */
export const bottleGroupRepresentative = {
  ...buildBottle({
    id: 50_101,
    name: "16-year-old Cask 42 (2022)",
    totalTastings: 12,
  }),
  imageUrl: bottleImageUrl,
  fullName: "Lagavulin 16-year-old Cask 42 (2022)",
  edition: "Cask 42",
  statedAge: 16,
  abv: 55.1,
  vintageYear: 2005,
  releaseYear: 2022,
  singleCask: true,
  caskStrength: true,
  caskFill: "1st_fill",
  caskType: "oloroso",
  caskSize: "hogshead",
};

/** @type {ConcreteFixtureBottle} */
export const bottleGroupMember = {
  ...buildBottle({
    id: 50_102,
    name: "16-year-old Distillers Edition (2023)",
    totalTastings: 17,
  }),
  fullName: "Lagavulin 16-year-old Distillers Edition (2023)",
  edition: "Distillers Edition",
  statedAge: 16,
  abv: 43,
  vintageYear: 2007,
  releaseYear: 2023,
};

/** @type {ConcreteFixtureBottle} */
const bottleGroupThirdMember = {
  ...buildBottle({
    id: 50_103,
    name: "16-year-old Feis Ile (2024)",
    totalTastings: 8,
  }),
  fullName: "Lagavulin 16-year-old Feis Ile (2024)",
  edition: "Feis Ile",
  statedAge: 16,
  abv: 52.4,
  releaseYear: 2024,
};

export const bottleGroup = {
  ...buildBottleGroup({
    id: bottleGroupId,
    fullName: "Lagavulin 16-year-old release family",
    name: "16-year-old release family",
    bottle: bottleGroupRepresentative,
    representativeBottleId: bottleGroupRepresentative.id,
  }),
  ratingStats: bottleGroupRatingStats,
  avgRating: bottleGroupRatingStats.avg,
  totalTastings: 37,
  totalBottles: 3,
};

/** @type {(ConcreteFixtureBottle & {group: BottleGroupV1})[]} */
export const bottleGroupMembers = [
  bottleGroupRepresentative,
  bottleGroupMember,
  bottleGroupThirdMember,
].map((bottle) => ({ ...bottle, group: bottleGroup }));

export const flightBottleFixtureId = "flight-bottles";
export const createdFlightBottleFixtureId = "flight-bottles-created";
export const flightBottleFixture = {
  id: flightBottleFixtureId,
  name: "Related Bottle flight",
  description: "A Flight containing independently complete Bottles.",
  public: true,
  createdAt: timestamp,
  createdBy: testUser,
  bottles: [
    {
      bottle: bottleGroupMembers[0],
      hasTasted: false,
      isLibrary: false,
    },
    {
      bottle: bottleGroupMembers[1],
      hasTasted: false,
      isLibrary: false,
    },
  ],
};

export const destinationBottleGroup = {
  ...buildBottleGroup({
    id: destinationBottleGroupId,
    fullName: "Lagavulin Destination Expression",
    name: "Destination Expression",
    bottle: existingBottle,
  }),
  totalBottles: 2,
};

export const groupedBottleDetails = {
  ...bottleGroupRepresentative,
  group: bottleGroup,
};

export const priceChangeFirstBottle = existingBottle;
export const priceChangeSecondBottle = exactSearchBottle;

export const priceChangeList = {
  results: [
    {
      id: priceChangeFirstBottle.id,
      price: 7_999,
      previousPrice: 8_999,
      currency: "usd",
      bottle: priceChangeFirstBottle,
      isLibrary: true,
      hasTasted: false,
    },
    {
      id: priceChangeSecondBottle.id,
      price: 6_499,
      previousPrice: 5_999,
      currency: "usd",
      bottle: priceChangeSecondBottle,
      isLibrary: false,
      hasTasted: true,
    },
  ],
  rel: {
    nextCursor: null,
    prevCursor: null,
  },
};

export const priceSite = {
  id: 9901,
  type: "whiskyadvocate",
  name: "Whisky Advocate",
  lastRunAt: timestamp,
  nextRunAt: null,
  runEvery: 60,
};

export const firstStorePriceName = "First Bottle store listing";
export const secondStorePriceName = "Second Bottle store listing";
export const unresolvedStorePriceName = "Unresolved store listing";

export const storePriceList = {
  results: [
    {
      id: 9902,
      name: firstStorePriceName,
      price: 7_999,
      currency: "usd",
      url: "https://example.com/first-bottle",
      volume: 750,
      updatedAt: timestamp,
      imageUrl: null,
      isValid: true,
      bottle: priceChangeFirstBottle,
    },
    {
      id: 9903,
      name: secondStorePriceName,
      price: 6_499,
      currency: "usd",
      url: "https://example.com/second-bottle",
      volume: 750,
      updatedAt: timestamp,
      imageUrl: null,
      isValid: true,
      bottle: priceChangeSecondBottle,
    },
    {
      id: 9904,
      name: unresolvedStorePriceName,
      price: 5_499,
      currency: "usd",
      url: "https://example.com/unresolved",
      volume: 750,
      updatedAt: timestamp,
      imageUrl: null,
      isValid: true,
      bottle: null,
    },
  ],
  rel: {
    nextCursor: null,
    prevCursor: null,
  },
};

/**
 * @typedef {object} CollectionBottleFixtureOptions
 * @property {number} [id]
 * @property {CollectionBottle["bottle"]} [bottle]
 * @property {string | null} [imageUrl]
 * @property {CollectionBottle["status"]} [status]
 * @property {boolean} [hasTasted]
 */

/**
 * @param {CollectionBottleFixtureOptions} [options]
 * @returns {CollectionBottle}
 */
export function buildCollectionBottle({
  id = 1,
  bottle = /** @type {CollectionBottle["bottle"]} */ (buildBottle()),
  imageUrl = null,
  status = null,
  hasTasted = false,
} = {}) {
  return {
    id,
    imageUrl,
    status,
    bottle,
    hasTasted,
  };
}

export function buildCollection({
  id = 9601,
  name = "Library",
  href = `/users/${testUser.username}/library`,
} = {}) {
  return {
    id,
    name,
    totalBottles: 1,
    createdAt: timestamp,
    href,
  };
}

/**
 * @param {{
 *   id?: number,
 *   bottle?: FixtureBottle | ConcreteFixtureBottle,
 *   notes?: string,
 *   rating?: number,
 *   tags?: string[],
 * }} [options]
 */
export function buildTasting({
  id = createdTastingId,
  bottle = existingBottle,
  notes = tastingNotes,
  rating = 2,
  tags = /** @type {string[]} */ ([]),
} = {}) {
  return {
    id,
    imageUrl: null,
    notes,
    bottle,
    rating,
    tags,
    color: null,
    servingStyle: null,
    friends: [],
    awards: [],
    comments: 0,
    toasts: 0,
    hasToasted: false,
    createdAt: timestamp,
    createdBy: testUser,
  };
}

export function buildActivity({
  tasting = buildTasting({
    bottle: {
      ...existingBottle,
      isFavorite: true,
    },
  }),
  collectionBottle = buildCollectionBottle({ id: 9701 }),
} = {}) {
  return {
    results: [
      {
        id: `tasting:${tasting.id}`,
        type: "tasting",
        priority: "primary",
        createdAt: tasting.createdAt,
        tasting,
      },
      {
        id: "collection_add:9101:9601:1780833600000",
        type: "collection_add",
        priority: "secondary",
        createdAt: timestamp,
        windowStart: timestamp,
        windowEnd: timestamp,
        createdBy: testUser,
        collection: buildCollection(),
        items: [collectionBottle],
        totalItems: 1,
      },
    ],
    rel: {
      nextCursor: null,
      prevCursor: null,
    },
  };
}

export function buildFavoriteActivity({ nextCursor = null } = {}) {
  return {
    results: Array.from({ length: 10 }, (_, index) => ({
      id: `collection_add:9101:9801:${1780833600000 + index}`,
      type: "collection_add",
      priority: "secondary",
      createdAt: timestamp,
      windowStart: timestamp,
      windowEnd: timestamp,
      createdBy: testUser,
      collection: buildCollection({
        id: 9801,
        name: "Personal Favorites",
        href: `/users/${testUser.username}/favorites`,
      }),
      items: [buildCollectionBottle({ id: 9802 + index })],
      totalItems: 1,
    })),
    rel: {
      nextCursor,
      prevCursor: null,
    },
  };
}

export const suggestedTags = {
  results: [
    {
      tag: {
        name: "smoke",
        synonyms: [],
        tagCategory: "peat",
        flavorProfiles: ["smoky"],
      },
      count: 3,
    },
    {
      tag: {
        name: "citrus",
        synonyms: [],
        tagCategory: "fruity",
        flavorProfiles: ["fruity"],
      },
      count: 1,
    },
  ],
};

export const emptyList = {
  results: [],
  rel: {
    nextCursor: null,
    prevCursor: null,
  },
};
