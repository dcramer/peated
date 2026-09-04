import {
  mockActivity,
  mockExternalReview,
  mockFriendships,
} from "@peated/server/orpc/mock/fixtures";
import { beforeEach, expect, test, vi } from "vitest";
import {
  getActivityFeedHref,
  getActivityFeedSelection,
  loadActivityFeed,
  requiresActivityFeedLogin,
} from "./loadActivityFeed";

type Options = Parameters<typeof loadActivityFeed>[0];
const publicClient = {
  activity: { list: vi.fn<Options["publicClient"]["activity"]["list"]>() },
};
const memberClient = {
  friends: {
    list: vi.fn<NonNullable<Options["memberClient"]>["friends"]["list"]>(),
  },
  activity: {
    list: vi.fn<NonNullable<Options["memberClient"]>["activity"]["list"]>(),
  },
};
const rel = { nextCursor: null, prevCursor: null };
const criticActivity = {
  id: `critic_review:${mockExternalReview.id}`,
  type: "critic_review" as const,
  priority: "primary" as const,
  createdAt: mockExternalReview.article.publishedAt!,
  review: mockExternalReview,
};

beforeEach(() => {
  vi.resetAllMocks();
  memberClient.friends.list.mockResolvedValue({
    results: mockFriendships,
    rel,
  });
  memberClient.activity.list.mockResolvedValue({ results: [], rel });
  publicClient.activity.list.mockResolvedValue({
    results: [mockActivity[0], criticActivity],
    rel,
  });
});

test("defaults the activity feed selection to Everyone", () => {
  expect(getActivityFeedSelection()).toBe("everyone");
  expect(getActivityFeedSelection("everyone")).toBe("everyone");
  expect(getActivityFeedSelection("unknown")).toBe("everyone");
  expect(getActivityFeedSelection("following")).toBe("following");
});

test("sends anonymous Following visitors to login", () => {
  expect(getActivityFeedHref({ feed: "following", isLoggedIn: false })).toBe(
    "/login?redirectTo=%2Factivity%3Ffeed%3Dfollowing",
  );
  expect(getActivityFeedHref({ feed: "everyone", isLoggedIn: false })).toBe(
    "/activity?feed=everyone",
  );
});

test("keeps signed-in activity links on the activity page", () => {
  expect(getActivityFeedHref({ feed: "following", isLoggedIn: true })).toBe(
    "/activity?feed=following",
  );
});

test("requires login only for anonymous Following visitors", () => {
  expect(
    requiresActivityFeedLogin({ feed: "following", isLoggedIn: false }),
  ).toBe(true);
  expect(
    requiresActivityFeedLogin({ feed: "following", isLoggedIn: true }),
  ).toBe(false);
  expect(
    requiresActivityFeedLogin({ feed: "everyone", isLoggedIn: false }),
  ).toBe(false);
});

test("keeps Following empty when followed people have no activity", async () => {
  const feed = await loadActivityFeed({
    following: true,
    memberClient,
    publicClient,
  });

  expect(memberClient.friends.list).toHaveBeenCalledWith({
    filter: "active",
    limit: 1,
  });
  expect(memberClient.activity.list).toHaveBeenCalledWith({
    cursor: undefined,
    filter: "friends",
    limit: 20,
  });
  expect(feed.items).toEqual([]);
  expect(feed.note).toBeUndefined();
  expect(publicClient.activity.list).not.toHaveBeenCalled();
});

test("falls back to Everyone only when there are no accepted follows", async () => {
  memberClient.friends.list.mockResolvedValue({ results: [], rel });
  const feed = await loadActivityFeed({
    following: true,
    memberClient,
    publicClient,
  });

  expect(feed.note).toBe(
    "You're not following anyone yet. Showing everyone's activity.",
  );
  expect(feed.items).toHaveLength(3);
  expect(memberClient.activity.list).not.toHaveBeenCalled();
  expect(publicClient.activity.list).toHaveBeenCalledWith({
    cursor: undefined,
    includeCriticReviews: true,
    limit: 20,
  });
});

test("does not hide a failed follow lookup by showing Everyone", async () => {
  const error = new Error("Follow lookup failed");
  memberClient.friends.list.mockRejectedValue(error);

  await expect(
    loadActivityFeed({ following: true, memberClient, publicClient }),
  ).rejects.toBe(error);
  expect(publicClient.activity.list).not.toHaveBeenCalled();
});

test("uses public activity for Everyone even when signed in", async () => {
  const feed = await loadActivityFeed({
    following: false,
    memberClient,
    publicClient,
  });

  expect(feed.items).toHaveLength(3);
  expect(memberClient.friends.list).not.toHaveBeenCalled();
  expect(memberClient.activity.list).not.toHaveBeenCalled();
});

test("loads the requested activity page and returns its links", async () => {
  publicClient.activity.list.mockResolvedValue({
    results: [],
    rel: { nextCursor: "3:1780833600000", prevCursor: "1:1780833600000" },
  });

  const feed = await loadActivityFeed({
    cursor: "2:1780833600000",
    following: false,
    publicClient,
  });

  expect(publicClient.activity.list).toHaveBeenCalledWith({
    cursor: "2:1780833600000",
    includeCriticReviews: true,
    limit: 20,
  });
  expect(feed.rel).toEqual({
    nextCursor: "3:1780833600000",
    prevCursor: "1:1780833600000",
  });
});

test("anonymous Following uses public activity and explains sign-in", async () => {
  const feed = await loadActivityFeed({ following: true, publicClient });

  expect(feed.note).toBe(
    "Sign in to follow people. Showing everyone's activity.",
  );
  expect(feed.items).toHaveLength(3);
  expect(memberClient.friends.list).not.toHaveBeenCalled();
});
