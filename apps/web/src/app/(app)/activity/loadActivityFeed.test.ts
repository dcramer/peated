import {
  mockActivity,
  mockExternalReview,
  mockFriendships,
} from "@peated/server/orpc/mock/fixtures";
import { beforeEach, expect, test, vi } from "vitest";
import { getActivityFeedSelection, loadActivityFeed } from "./loadActivityFeed";

type Options = Parameters<typeof loadActivityFeed>[0];
const publicClient = {
  activity: { list: vi.fn<Options["publicClient"]["activity"]["list"]>() },
  externalReviews: {
    list: vi.fn<Options["publicClient"]["externalReviews"]["list"]>(),
  },
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

beforeEach(() => {
  vi.resetAllMocks();
  memberClient.friends.list.mockResolvedValue({
    results: mockFriendships,
    rel,
  });
  memberClient.activity.list.mockResolvedValue({ results: [], rel });
  publicClient.activity.list.mockResolvedValue({
    results: [mockActivity[0]],
    rel,
  });
  publicClient.externalReviews.list.mockResolvedValue({
    results: [mockExternalReview],
    rel,
  });
});

test("defaults the activity feed selection to Everyone", () => {
  expect(getActivityFeedSelection()).toBe("everyone");
  expect(getActivityFeedSelection("everyone")).toBe("everyone");
  expect(getActivityFeedSelection("unknown")).toBe("everyone");
  expect(getActivityFeedSelection("following")).toBe("following");
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
    filter: "friends",
    limit: 20,
  });
  expect(feed.items).toEqual([]);
  expect(feed.note).toBeUndefined();
  expect(publicClient.activity.list).not.toHaveBeenCalled();
  expect(publicClient.externalReviews.list).not.toHaveBeenCalled();
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
  expect(feed.items).toHaveLength(2);
  expect(memberClient.activity.list).not.toHaveBeenCalled();
  expect(publicClient.externalReviews.list).toHaveBeenCalled();
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

  expect(feed.items).toHaveLength(2);
  expect(memberClient.friends.list).not.toHaveBeenCalled();
  expect(memberClient.activity.list).not.toHaveBeenCalled();
});

test("anonymous Following uses public activity and explains sign-in", async () => {
  const feed = await loadActivityFeed({ following: true, publicClient });

  expect(feed.note).toBe(
    "Sign in to follow people. Showing everyone's activity.",
  );
  expect(feed.items).toHaveLength(2);
  expect(memberClient.friends.list).not.toHaveBeenCalled();
});
