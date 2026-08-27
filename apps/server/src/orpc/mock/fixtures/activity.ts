import type { MockOutputs } from "../contract";
import { mockBottles } from "./bottles";
import { mockCollectionBottle, mockCollectionBottles } from "./collections";
import { timestamp } from "./constants";
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
