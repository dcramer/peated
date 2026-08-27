import type { MockOutputs } from "../contract";
import { mockImageUrls, timestamp } from "./constants";

type User = MockOutputs["auth"]["login"]["user"];
export type MockUser = User;

// Users
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

export const mockFriends = [
  {
    id: 9102,
    username: "islay-dreamer",
    pictureUrl: mockImageUrls.profile,
    private: false,
    friendStatus: "friends",
  },
  {
    id: 9103,
    username: "bourbon-notes",
    pictureUrl: null,
    private: false,
    friendStatus: "friends",
  },
] satisfies User[];

export const mockPublicUserDetails = {
  ...mockPublicUser,
  stats: mockUserDetails.stats,
} satisfies MockOutputs["users"]["details"];

export const mockFriendDetails = [
  {
    ...mockFriends[0]!,
    stats: {
      tastings: 128,
      bottles: 82,
      collected: 64,
      library: { total: 20, open: 7, sealed: 13 },
      contributions: 18,
    },
  },
  {
    ...mockFriends[1]!,
    stats: {
      tastings: 86,
      bottles: 65,
      collected: 40,
      library: { total: 9, open: 3, sealed: 6 },
      contributions: 5,
    },
  },
] satisfies MockOutputs["users"]["details"][];

export const mockPublicUserDetailsList = [
  mockPublicUserDetails,
  ...mockFriendDetails,
];

export function mockUserDetailsFor(
  user: User | null,
  profile: MockOutputs["users"]["details"] = mockPublicUserDetails,
) {
  return user?.id === profile.id ? { ...profile, ...user } : profile;
}

export function matchesMockUser(value: string | number, user: User | null) {
  return value === "me"
    ? Boolean(user)
    : mockPublicUserDetailsList.some(
        (profile) => value === profile.id || value === profile.username,
      );
}
