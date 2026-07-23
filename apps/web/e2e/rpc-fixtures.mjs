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
export const existingReleaseId = 9303;
export const legacyPromotedBottleId = 9305;
export const legacyIncompleteReleaseId = 9306;
export const exactReplacementSourceBottleId = 9307;
export const retiredParentBottleId = 9308;
export const missingPageTargetBottleId = 9309;
export const conflictingPageTargetBottleId = 9310;
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

export const existingBottle = buildBottle();

export const exactSearchBottle = {
  ...buildBottle({
    id: 9307,
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

/**
 * Builds the bottle-release RPC fixture used by bottling-specific E2E flows.
 */
export function buildBottleRelease({
  id = existingReleaseId,
  bottleId = existingBottleId,
  fullName = `${existingBottle.fullName} Distillers Edition`,
  name = "Distillers Edition",
  edition = "Distillers Edition",
  releaseYear = 2024,
} = {}) {
  return {
    id,
    bottleId,
    fullName,
    name,
    edition,
    statedAge: null,
    abv: null,
    caskStrength: null,
    singleCask: null,
    vintageYear: null,
    releaseYear,
    caskType: null,
    caskSize: null,
    caskFill: null,
    description: null,
    tastingNotes: null,
    imageUrl: null,
    avgRating: null,
    totalTastings: 0,
    suggestedTags: [],
    isFavorite: false,
    hasTasted: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export const existingRelease = buildBottleRelease();

export const legacyPromotedBottle = {
  ...existingBottle,
  id: legacyPromotedBottleId,
  fullName: existingRelease.fullName,
  name: existingRelease.name,
  edition: existingRelease.edition,
  statedAge: existingRelease.statedAge ?? existingBottle.statedAge,
  abv: existingRelease.abv,
  caskStrength: existingRelease.caskStrength,
  singleCask: existingRelease.singleCask,
  vintageYear: existingRelease.vintageYear,
  releaseYear: existingRelease.releaseYear,
  caskType: existingRelease.caskType,
  caskSize: existingRelease.caskSize,
  caskFill: existingRelease.caskFill,
  description: existingRelease.description ?? existingBottle.description,
  imageUrl: existingRelease.imageUrl ?? existingBottle.imageUrl,
  tastingNotes: existingRelease.tastingNotes ?? existingBottle.tastingNotes,
  suggestedTags: existingRelease.suggestedTags,
  avgRating: existingRelease.avgRating,
  totalTastings: existingRelease.totalTastings,
  isFavorite: existingRelease.isFavorite,
  hasTasted: existingRelease.hasTasted,
  createdAt: existingRelease.createdAt,
  updatedAt: existingRelease.updatedAt,
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
/** @typedef {ReturnType<typeof buildBottleRelease>} FixtureBottleRelease */
/** @typedef {import("@peated/server/schemas").BottleGroupV1} BottleGroupV1 */
/** @typedef {import("@peated/server/schemas").CatalogTargetV1} CatalogTargetV1 */
/** @typedef {import("@peated/server/schemas").ExactCatalogTargetV1} ExactCatalogTargetV1 */
/** @typedef {import("@peated/server/schemas").GenericCatalogTargetV1} GenericCatalogTargetV1 */
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
function buildBottleGroup({
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
    description: bottle.description,
    descriptionSrc: bottle.descriptionSrc,
    imageUrl: bottle.imageUrl,
    flavorProfile: bottle.flavorProfile,
    tastingNotes: bottle.tastingNotes,
    suggestedTags: bottle.suggestedTags,
    avgRating: bottle.avgRating,
    ratingStats: bottle.ratingStats,
    totalTastings: bottle.totalTastings,
    totalBottles: 1,
    createdByActorId: testUser.id,
    createdAt: bottle.createdAt,
    updatedAt: bottle.updatedAt,
  };
}

/**
 * @typedef {object} ExactCatalogTargetFixtureOptions
 * @property {FixtureBottle | ConcreteFixtureBottle} [bottle]
 * @property {FixtureBottleRelease | null} [release]
 */

/**
 * @param {ExactCatalogTargetFixtureOptions} [options]
 * @returns {ExactCatalogTargetV1}
 */
export function buildExactCatalogTarget({
  bottle = existingBottle,
  release = null,
} = {}) {
  const group = buildBottleGroup({ bottle });
  const concreteBottleId = release?.id ?? bottle.id;
  const fullName = release
    ? `${bottle.fullName} - ${release.edition ?? release.name}${
        release.releaseYear ? ` (${release.releaseYear})` : ""
      }`
    : bottle.fullName;

  return {
    schemaVersion: 1,
    kind: "bottle",
    targetId: (release ? 20_000_000 : 10_000_000) + (release?.id ?? bottle.id),
    group,
    bottle: {
      schemaVersion: 1,
      id: concreteBottleId,
      groupId: group.id,
      fullName,
      name: release?.name ?? bottle.name,
      brandId: bottle.brand.id,
      bottlerId: bottle.bottler?.id ?? null,
      distillerIds: bottle.distillers.map((distiller) => distiller.id),
      category: /** @type {ExactCatalogTargetV1["bottle"]["category"]} */ (
        bottle.category
      ),
      seriesId: bottle.series?.id ?? null,
      flavorProfile: bottle.flavorProfile,
      edition: release ? release.edition : bottle.edition,
      statedAge: release ? release.statedAge : bottle.statedAge,
      abv: release ? release.abv : bottle.abv,
      singleCask: release ? release.singleCask : bottle.singleCask,
      caskStrength: release ? release.caskStrength : bottle.caskStrength,
      vintageYear: release ? release.vintageYear : bottle.vintageYear,
      releaseYear: release ? release.releaseYear : bottle.releaseYear,
      caskSize: release ? release.caskSize : bottle.caskSize,
      caskType: release ? release.caskType : bottle.caskType,
      caskFill: release ? release.caskFill : bottle.caskFill,
      description: release ? release.description : bottle.description,
      descriptionSrc: bottle.descriptionSrc,
      imageUrl: release ? release.imageUrl : bottle.imageUrl,
      tastingNotes: release ? release.tastingNotes : bottle.tastingNotes,
      suggestedTags: release ? release.suggestedTags : bottle.suggestedTags,
      avgRating: release ? release.avgRating : bottle.avgRating,
      ratingStats: bottle.ratingStats,
      totalTastings: release ? release.totalTastings : bottle.totalTastings,
      createdByActorId: testUser.id,
      createdAt: release ? release.createdAt : bottle.createdAt,
      updatedAt: release ? release.updatedAt : bottle.updatedAt,
    },
  };
}

export const genericCollectionTargetLabel = "Lagavulin Core Range";
export const genericCollectionTargetGroupId = 40_000_002;

/** @returns {GenericCatalogTargetV1} */
export function buildGenericCatalogTarget() {
  return {
    schemaVersion: 1,
    kind: "group",
    targetId: 40_000_001,
    group: buildBottleGroup({
      id: genericCollectionTargetGroupId,
      fullName: genericCollectionTargetLabel,
      name: "Core Range",
      representativeBottleId: existingBottle.id,
    }),
  };
}

export const bottleGroupId = 50_001;
export const destinationBottleGroupId = 50_002;
export const splitBottleGroupId = 50_003;

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
  description:
    "The shared expression context for several independently identified releases.",
  imageUrl: bottleImageUrl,
  ratingStats: bottleGroupRatingStats,
  avgRating: bottleGroupRatingStats.avg,
  totalTastings: 37,
  totalBottles: 3,
};

/**
 * Rebinds an independently complete exact Bottle target to the shared group fixture.
 *
 * @param {ConcreteFixtureBottle} bottle
 * @param {number} targetId
 */
function buildBottleGroupMemberTarget(bottle, targetId) {
  const target = buildExactCatalogTarget({ bottle });
  return {
    ...target,
    targetId,
    group: bottleGroup,
    bottle: {
      ...target.bottle,
      groupId: bottleGroup.id,
    },
  };
}

export const bottleGroupMemberTargets = [
  buildBottleGroupMemberTarget(bottleGroupRepresentative, 50_201),
  buildBottleGroupMemberTarget(bottleGroupMember, 50_202),
  buildBottleGroupMemberTarget(bottleGroupThirdMember, 50_203),
];

export const bottleGroupTarget = {
  schemaVersion: 1,
  kind: "group",
  targetId: 50_200,
  group: bottleGroup,
};

export const flightTargetFixtureId = "flight-targets";
export const createdFlightTargetFixtureId = "flight-targets-created";
export const flightTargetFixture = {
  id: flightTargetFixtureId,
  name: "Exact and generic targets",
  description: "A Flight that keeps target exactness explicit.",
  public: true,
  createdAt: timestamp,
  createdBy: testUser,
  targets: [
    {
      target: bottleGroupMemberTargets[0],
      distillers: [testBrand],
      hasTasted: false,
      isLibrary: false,
    },
    {
      target: bottleGroupTarget,
      distillers: [testBrand],
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

export const destinationBottleGroupTarget = {
  schemaVersion: 1,
  kind: "group",
  targetId: 50_210,
  group: destinationBottleGroup,
};

const splitBottleGroup = {
  ...bottleGroup,
  id: splitBottleGroupId,
  fullName: "Lagavulin Split Expression",
  name: "Split Expression",
  representativeBottleId: bottleGroupRepresentative.id,
  totalBottles: 1,
};

export const splitBottleGroupTarget = {
  schemaVersion: 1,
  kind: "group",
  targetId: 50_220,
  group: splitBottleGroup,
};

export const groupedBottleDetails = {
  ...bottleGroupRepresentative,
  group: bottleGroup,
};

export const priceChangeExactTarget = buildExactCatalogTarget();
export const priceChangeGenericTarget = buildGenericCatalogTarget();

export const priceChangeList = {
  results: [
    {
      id: priceChangeExactTarget.targetId,
      price: 7_999,
      previousPrice: 8_999,
      currency: "usd",
      target: priceChangeExactTarget,
      isLibrary: true,
      hasTasted: false,
    },
    {
      id: priceChangeGenericTarget.targetId,
      price: 6_499,
      previousPrice: 5_999,
      currency: "usd",
      target: priceChangeGenericTarget,
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

export const exactStorePriceName = "Exact bottle store listing";
export const genericStorePriceName = "Generic range store listing";
export const targetlessStorePriceName = "Unresolved store listing";

export const storePriceList = {
  results: [
    {
      id: 9902,
      name: exactStorePriceName,
      price: 7_999,
      currency: "usd",
      url: "https://example.com/exact-bottle",
      volume: 750,
      updatedAt: timestamp,
      imageUrl: null,
      isValid: true,
      target: priceChangeExactTarget,
    },
    {
      id: 9903,
      name: genericStorePriceName,
      price: 6_499,
      currency: "usd",
      url: "https://example.com/generic-range",
      volume: 750,
      updatedAt: timestamp,
      imageUrl: null,
      isValid: true,
      target: priceChangeGenericTarget,
    },
    {
      id: 9904,
      name: targetlessStorePriceName,
      price: 5_499,
      currency: "usd",
      url: "https://example.com/unresolved",
      volume: 750,
      updatedAt: timestamp,
      imageUrl: null,
      isValid: true,
      target: null,
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
 * @property {CatalogTargetV1} [target]
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
  target = buildExactCatalogTarget(),
  imageUrl = null,
  status = null,
  hasTasted = false,
} = {}) {
  return {
    id,
    imageUrl,
    status,
    target,
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
 *   target?: CatalogTargetV1,
 *   notes?: string,
 *   rating?: number,
 *   tags?: string[],
 * }} [options]
 */
export function buildTasting({
  id = createdTastingId,
  bottle = existingBottle,
  target,
  notes = tastingNotes,
  rating = 2,
  tags = /** @type {string[]} */ ([]),
} = {}) {
  return {
    id,
    imageUrl: null,
    notes,
    target: target ?? buildExactCatalogTarget({ bottle }),
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
