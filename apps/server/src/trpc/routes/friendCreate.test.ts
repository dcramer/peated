import { db } from "@peated/server/db";
import { and, eq } from "drizzle-orm";
import { follows, notifications } from "../../db/schema";
import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("requires authentication", async () => {
  const caller = appRouter.createCaller({ user: null });
  expect(() =>
    caller.friendCreate(DefaultFixtures.user.id),
  ).rejects.toThrowError(/UNAUTHORIZED/);
});

test("cannot friend self", async () => {
  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  expect(() =>
    caller.friendCreate(DefaultFixtures.user.id),
  ).rejects.toThrowError(/Cannot friend yourself/);
});

test("can friend new link", async () => {
  const otherUser = await Fixtures.User();

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  const data = await caller.friendCreate(otherUser.id);

  expect(data.status).toEqual("pending");

  const [follow] = await db
    .select()
    .from(follows)
    .where(
      and(
        eq(follows.fromUserId, DefaultFixtures.user.id),
        eq(follows.toUserId, otherUser.id),
      ),
    );
  expect(follow).toBeDefined();
  expect(follow.status).toBe("pending");

  const [notif] = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.objectId, follow.id),
        eq(notifications.type, "friend_request"),
      ),
    );

  expect(notif).toBeDefined();
  expect(notif.fromUserId).toEqual(follow.fromUserId);
  expect(notif.userId).toEqual(follow.toUserId);
});

test("can friend existing link", async () => {
  const otherUser = await Fixtures.User();

  const follow = await Fixtures.Follow({
    fromUserId: DefaultFixtures.user.id,
    toUserId: otherUser.id,
    status: "following",
  });

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  const data = await caller.friendCreate(otherUser.id);

  expect(data.status).toEqual("friends");

  const [newFollow] = await db
    .select()
    .from(follows)
    .where(
      and(
        eq(follows.fromUserId, DefaultFixtures.user.id),
        eq(follows.toUserId, otherUser.id),
      ),
    );
  expect(newFollow).toBeDefined();
  expect(newFollow.status).toEqual(follow.status);
});

test("approves when mutual", async () => {
  const otherUser = await Fixtures.User();
  await Fixtures.Follow({
    fromUserId: otherUser.id,
    toUserId: DefaultFixtures.user.id,
    status: "pending",
  });

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  const data = await caller.friendCreate(otherUser.id);

  expect(data.status).toEqual("friends");

  const [follow] = await db
    .select()
    .from(follows)
    .where(
      and(
        eq(follows.fromUserId, DefaultFixtures.user.id),
        eq(follows.toUserId, otherUser.id),
      ),
    );
  expect(follow).toBeDefined();
  expect(follow.status).toEqual("following");

  const [notif] = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.objectId, follow.id),
        eq(notifications.type, "friend_request"),
      ),
    );

  expect(notif).toBeUndefined();
});
