import type { MockOutputs } from "../contract";
import { mockBottleGroup } from "./bottle-groups";
import { mockImageUrls, timestamp } from "./constants";
import {
  mockBuffaloTraceEntity,
  mockEntity,
  mockLaphroaigEntity,
  mockMacallanEntity,
  mockMidletonEntity,
  mockRedbreastEntity,
  mockSpringbankEntity,
  mockYamazakiEntity,
} from "./entities";

type Bottle = MockOutputs["bottles"]["list"]["results"][number];
type BottleDetails = MockOutputs["bottles"]["details"];
type User = MockOutputs["auth"]["login"]["user"];

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
  {
    ...mockBottle,
    id: 9309,
    peatedId: "B9309",
    fullName: "Laphroaig Càirdeas Warehouse 1",
    name: "Càirdeas",
    group: mockBottleGroup,
    edition: "Warehouse 1",
    statedAge: null,
    noAgeStatement: true,
    caskStrength: true,
    abv: 52.2,
    releaseYear: 2022,
    brand: mockLaphroaigEntity,
    distillers: [mockLaphroaigEntity],
    description:
      "The 2022 Càirdeas release, matured in first-fill bourbon barrels in Warehouse 1.",
    imageUrl: mockImageUrls.cairdeasWarehouse1,
    flavorProfile: "heavily_peated",
    tastingNotes: {
      nose: "Sea spray, vanilla, and peat smoke",
      palate: "Brine, pepper, and sweet oak",
      finish: "Long, smoky, and coastal",
    },
    suggestedTags: ["peat", "brine", "vanilla", "pepper"],
    avgRating: 1.6,
    avgScore: 90,
    totalScores: 18,
    ratingStats: ratingStats(1, 4, 13),
    totalTastings: 42,
    createdAt: "2022-05-27T12:00:00.000Z",
    updatedAt: timestamp,
  },
  {
    ...mockBottle,
    id: 9310,
    peatedId: "B9310",
    fullName: "Laphroaig Càirdeas White Port & Madeira",
    name: "Càirdeas",
    group: mockBottleGroup,
    edition: "White Port & Madeira",
    statedAge: null,
    noAgeStatement: true,
    caskStrength: true,
    abv: 52.3,
    releaseYear: 2023,
    brand: mockLaphroaigEntity,
    distillers: [mockLaphroaigEntity],
    description:
      "The 2023 Càirdeas release, finished in White Port and Madeira casks.",
    imageUrl: mockImageUrls.cairdeasWhitePortMadeira,
    flavorProfile: "heavily_peated",
    tastingNotes: {
      nose: "Red fruit, smoke, and sea salt",
      palate: "Berry sweetness, peat, and spice",
      finish: "Smoky, fruity, and warming",
    },
    suggestedTags: ["peat", "red fruit", "sea salt", "spice"],
    avgRating: 1.4,
    avgScore: 88,
    totalScores: 12,
    ratingStats: ratingStats(1, 4, 7),
    totalTastings: 33,
    createdAt: "2023-05-26T12:00:00.000Z",
    updatedAt: timestamp,
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
