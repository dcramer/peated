import type { Outputs } from "@peated/server/orpc/router";

type Bottle = Outputs["bottles"]["list"]["results"][number];
type Entity = Outputs["entities"]["list"]["results"][number];
type User = Outputs["auth"]["login"]["user"];

const timestamp = "2026-08-26T12:00:00.000Z";

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
} satisfies Outputs["users"]["details"];

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
  country: null,
  region: null,
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
  isFavorite: true,
  isLibrary: true,
  hasTasted: true,
} satisfies Bottle;

export const mockBottleDetails = {
  ...mockBottle,
  barcodes: [{ value: "5000281016290", volume: 700 }],
  people: 96,
  lastPrice: null,
} satisfies Outputs["bottles"]["details"];

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
