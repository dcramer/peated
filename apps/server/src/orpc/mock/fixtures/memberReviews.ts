import type { MockOutputs } from "../contract";
import { mockBottleFor, mockBottles } from "./bottles";
import { mockImageUrls, timestamp } from "./constants";
import { mockFriends, mockPublicUser } from "./users";

type Review = MockOutputs["memberReviews"]["details"];
type User = MockOutputs["auth"]["login"]["user"];

export const mockMemberReview = {
  id: 9701,
  bottleId: mockBottles[8]!.id,
  bottle: mockBottles[8]!,
  score: 91,
  tags: ["smoke", "dried fruit", "sea salt"],
  color: 14,
  notes:
    "Freshly poured, this starts with clean peat smoke, sea spray, and lemon peel. The smoke is direct but not ashy. Vanilla and warm cereal sit underneath it, with a little green apple appearing after a few minutes in the glass.\n\nThe first sip is dense and oily. Brine arrives before the sweeter notes, then black pepper, toasted oak, and a restrained honeyed edge. At full strength the alcohol is firm but does not cover the whisky. The peat stays dry and coastal rather than turning medicinal.\n\nA few drops of water bring out more vanilla and citrus. They also soften the pepper without thinning the texture. The finish is long, smoky, and salty, with oak building near the end.\n\nThis is a focused Càirdeas release. It has enough sweetness to balance the peat, but Warehouse 1 remains more about smoke, brine, and structure than easy fruit.",
  servingStyle: "neat",
  friends: [mockFriends[0]!],
  imageUrl: mockImageUrls.cairdeasWarehouse1,
  createdBy: mockPublicUser,
  createdAt: timestamp,
  updatedAt: timestamp,
} satisfies Review;

export const mockMemberReviews: Review[] = [
  mockMemberReview,
  {
    ...mockMemberReview,
    id: 9702,
    score: 94,
    notes:
      "Bright coastal peat, lemon oil, and vanilla. Powerful, but the bourbon casks keep it focused.",
    tags: ["peat", "lemon", "vanilla"],
    friends: [],
    imageUrl: null,
    createdBy: mockFriends[0]!,
    createdAt: "2026-08-18T18:30:00.000Z",
    updatedAt: "2026-08-18T18:30:00.000Z",
  },
  {
    ...mockMemberReview,
    id: 9703,
    score: 89,
    notes:
      "Ash, brine, and sweet oak. A dense pour that opens well with a few drops of water.",
    tags: ["ash", "brine", "oak"],
    friends: [],
    imageUrl: null,
    createdBy: mockFriends[1]!,
    createdAt: "2026-08-09T21:15:00.000Z",
    updatedAt: "2026-08-09T21:15:00.000Z",
  },
];

export function mockMemberReviewFor(
  user: User | null,
  review: Review = mockMemberReview,
): Review {
  return {
    ...review,
    bottle: mockBottleFor(user, review.bottle),
  };
}
