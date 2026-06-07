const timestamp = "2026-06-07T12:00:00.000Z";

export const createdBottleName = "Playwright Reserve";
export const tastingNotes = "Smoke, lemon peel, and sea salt.";

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
export const createdTastingId = 9401;

export function buildBottle({
  id = existingBottleId,
  name = "16-year-old",
  brand = testBrand,
  totalTastings = 0,
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
    imageUrl: null,
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
    numReleases: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    isFavorite: false,
    hasTasted,
  };
}

export const existingBottle = buildBottle();

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
    release: null,
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
