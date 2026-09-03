import type { MockOutputs } from "../contract";
import { mockBottles } from "./bottles";
import { mockCollectionBottle, mockCollectionBottles } from "./collections";
import { timestamp } from "./constants";
import { mockMemberReviews } from "./memberReviews";
import { mockTasting, mockTastings } from "./tastings";
import { mockFriends, mockPublicUser } from "./users";

type ActivityEntry = MockOutputs["activity"]["list"]["results"][number];

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
  ...mockMemberReviews.map((review) => ({
    id: `member-review-${review.id}`,
    type: "member_review" as const,
    priority: "primary" as const,
    createdAt: review.createdAt,
    createdBy: review.createdBy,
    review,
  })),
  {
    id: "library-add-9703",
    type: "collection_add",
    priority: "secondary",
    createdAt: "2026-08-25T17:00:00.000Z",
    windowStart: "2026-08-25T17:00:00.000Z",
    windowEnd: "2026-08-25T17:00:00.000Z",
    createdBy: mockFriends[0]!,
    collection: {
      id: 9803,
      name: "Library",
      totalBottles: 1,
      createdAt: "2026-07-01T12:00:00.000Z",
      createdBy: mockFriends[0]!,
      href: `/users/${mockFriends[0]!.username}/library`,
    },
    items: [mockCollectionBottles[2]!],
    totalItems: 1,
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
      name: "Library",
      totalBottles: 3,
      createdAt: "2026-07-01T12:00:00.000Z",
      createdBy: mockPublicUser,
      href: `/users/${mockPublicUser.username}/library`,
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
