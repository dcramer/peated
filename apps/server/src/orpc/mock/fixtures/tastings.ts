import type { MockOutputs } from "../contract";
import { mockBottle, mockBottleFor, mockBottles } from "./bottles";
import { mockImageUrls, timestamp } from "./constants";
import { mockFriends, mockPublicUser } from "./users";

type Tasting = MockOutputs["tastings"]["details"];
type User = MockOutputs["auth"]["login"]["user"];

export const mockTasting = {
  id: 9601,
  imageUrl: null,
  notes: "Smoke, dried fruit, sea salt, and a long finish.",
  bottle: mockBottle,
  ratingBand: "outstanding",
  legacySimpleRating: null,
  legacyStarRating: null,
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
    ratingBand: "good",
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
    ratingBand: "outstanding",
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
    ratingBand: "good",
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
    ratingBand: "outstanding",
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
    ratingBand: "outstanding",
    tags: ["apple", "walnut", "honey", "allspice"],
    color: 13,
    servingStyle: "splash",
    friends: [mockFriends[0]!, mockFriends[1]!],
    comments: 0,
    toasts: 6,
    createdAt: "2026-08-14T18:00:00.000Z",
  },
  {
    ...mockTasting,
    id: 9607,
    imageUrl: mockImageUrls.cairdeasWarehouse1,
    notes: "Coastal smoke, vanilla, pepper, and a salty finish.",
    bottle: mockBottles[8]!,
    ratingBand: "unicorn",
    tags: ["peat", "brine", "vanilla", "pepper"],
    color: 11,
    servingStyle: "neat",
    comments: 0,
    toasts: 4,
    createdAt: "2026-08-12T20:15:00.000Z",
    createdBy: mockFriends[0]!,
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
