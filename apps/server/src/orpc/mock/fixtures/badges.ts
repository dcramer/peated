import type { MockOutputs } from "../contract";
import { timestamp } from "./constants";
import { mockFriends, mockPublicUser } from "./users";

type BadgeAward = MockOutputs["users"]["badgeList"]["results"][number];

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

export const mockBadgeAwards = [
  mockBadgeAward,
  {
    id: 9824,
    xp: 25,
    level: 5,
    badge: {
      id: 9825,
      name: "World Tour",
      maxLevel: 25,
      imageUrl: null,
    },
    createdAt: "2026-08-10T12:00:00.000Z",
    prevLevel: 4,
  },
  {
    id: 9826,
    xp: 8,
    level: 1,
    badge: {
      id: 9827,
      name: "Bourbon Trail",
      maxLevel: 25,
      imageUrl: null,
    },
    createdAt: "2026-07-28T12:00:00.000Z",
  },
  {
    id: 9828,
    xp: 40,
    level: 8,
    badge: {
      id: 9829,
      name: "Tasting Streak",
      maxLevel: 25,
      imageUrl: null,
    },
    createdAt: "2026-07-12T12:00:00.000Z",
    prevLevel: 7,
  },
] satisfies BadgeAward[];

export const mockBadges = mockBadgeAwards.map(
  (award) => award.badge,
) satisfies MockOutputs["badges"]["details"][];

export const mockBadgeUsers = [
  {
    id: 9950,
    xp: 42,
    level: 8,
    user: mockFriends[0]!,
    createdAt: "2026-05-10T12:00:00.000Z",
  },
  {
    id: 9951,
    xp: 31,
    level: 6,
    user: mockPublicUser,
    createdAt: "2026-06-14T12:00:00.000Z",
  },
  {
    id: 9952,
    xp: 19,
    level: 3,
    user: mockFriends[1]!,
    createdAt: "2026-07-22T12:00:00.000Z",
  },
] satisfies MockOutputs["badges"]["userList"]["results"];
