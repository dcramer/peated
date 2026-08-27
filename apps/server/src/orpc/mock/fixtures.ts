import type { MockOutputs } from "./contract";

type Bottle = MockOutputs["bottles"]["list"]["results"][number];
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

const timestamp = "2026-08-26T12:00:00.000Z";

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

export const mockPublicUserDetails = {
  ...mockPublicUser,
  stats: mockUserDetails.stats,
} satisfies MockOutputs["users"]["details"];

export function mockUserDetailsFor(user: User | null) {
  return user ? mockUserDetails : mockPublicUserDetails;
}

export function matchesMockUser(value: string | number, user: User | null) {
  return value === "me"
    ? Boolean(user)
    : value === mockUser.id || value === mockUser.username;
}

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

export function mockBottleFor(user: User | null): Bottle {
  return user
    ? {
        ...mockBottle,
        isFavorite: true,
        isLibrary: true,
        hasTasted: true,
      }
    : mockBottle;
}

export const mockBottleDetails = {
  ...mockBottle,
  barcodes: [{ value: "5000281016290", volume: 700 }],
  people: 96,
  lastPrice: null,
} satisfies MockOutputs["bottles"]["details"];

export function mockBottleDetailsFor(
  user: User | null,
): MockOutputs["bottles"]["details"] {
  return {
    ...mockBottleDetails,
    ...mockBottleFor(user),
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

export const mockComment = {
  id: 9803,
  comment: "The smoke opens up after a few minutes in the glass.",
  createdAt: timestamp,
  createdBy: mockPublicUser,
} satisfies Comment;

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

export const mockUserRegionList = {
  results: [
    {
      country: { name: mockCountry.name, slug: mockCountry.slug },
      region: { name: mockRegion.name, slug: mockRegion.slug },
      count: 42,
    },
  ],
  totalCount: 42,
} satisfies MockOutputs["users"]["regionList"];

export const mockUserFlavorList = {
  results: [{ flavorProfile: "peated", count: 42, score: 60 }],
  totalScore: 60,
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
  brands: [{ id: mockEntity.id, name: mockEntity.name, count: 12 }],
  distillers: [{ id: mockEntity.id, name: mockEntity.name, count: 12 }],
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
  categories: [{ category: "single_malt", count: 12 }],
} satisfies MockOutputs["users"]["libraryStats"];

export const mockFlight = {
  id: "mock-islay-flight",
  name: "Islay Smoke",
  description: "A side-by-side tasting of smoky Islay whisky.",
  public: true,
  createdAt: timestamp,
  createdBy: mockPublicUser,
} satisfies Flight;

export const mockFlightDetails = {
  ...mockFlight,
  bottles: [
    {
      bottle: mockBottle,
      hasTasted: false,
      isLibrary: false,
    },
  ],
} satisfies MockOutputs["flights"]["details"];

export function mockFlightDetailsFor(
  user: User | null,
): MockOutputs["flights"]["details"] {
  return {
    ...mockFlightDetails,
    bottles: [
      {
        bottle: mockBottleFor(user),
        hasTasted: Boolean(user),
        isLibrary: Boolean(user),
      },
    ],
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

export function mockTastingFor(user: User | null): Tasting {
  return {
    ...mockTasting,
    bottle: mockBottleFor(user),
    hasToasted: Boolean(user),
  };
}

export const mockCollectionBottle = {
  id: 9701,
  imageUrl: null,
  status: "open",
  bottle: mockBottle,
  hasTasted: true,
} satisfies CollectionBottle;

export const noMorePages = {
  nextCursor: null,
  prevCursor: null,
} as const;

export function includesQuery(query: string, ...values: (string | null)[]) {
  const normalizedQuery = query.trim().toLowerCase();
  return (
    normalizedQuery.length === 0 ||
    values.some((value) => value?.toLowerCase().includes(normalizedQuery))
  );
}
