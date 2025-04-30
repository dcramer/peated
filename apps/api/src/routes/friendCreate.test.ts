import { db } from "@peated/server/db";
import waitError from "@peated/server/lib/test/waitError";
import { and, eq } from "drizzle-orm";
import { follows, notifications } from "../db/schema";
import { createCaller } from "../trpc/router";

test("requires authentication", async ({ defaults }) => {
  const caller = createCaller({ user: null });
  const err = await waitError(caller.friendCreate(defaults.user.id));
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});

test("cannot friend self", async ({ defaults }) => {
  const caller = createCaller({ user: defaults.user });
  const err = await waitError(caller.friendCreate(defaults.user.id));
  expect(err).toMatchInlineSnapshot(`[TRPCError: Cannot friend yourself.]`);
});

test("can friend new link", async ({ defaults, fixtures }) => {
  const otherUser = await fixtures.User();

  const caller = createCaller({ user: defaults.user });
  const data = await caller.friendCreate(otherUser.id);

  expect(data.status).toEqual("pending");

  const [follow] = await db
    .select()
    .from(follows)
    .where(
      and(
        eq(follows.fromUserId, defaults.user.id),
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

test("can friend existing link", async ({ defaults, fixtures }) => {
  const otherUser = await fixtures.User();

  const follow = await fixtures.Follow({
    fromUserId: defaults.user.id,
    toUserId: otherUser.id,
    status: "following",
  });

  const caller = createCaller({ user: defaults.user });
  const data = await caller.friendCreate(otherUser.id);

  expect(data.status).toEqual("friends");

  const [newFollow] = await db
    .select()
    .from(follows)
    .where(
      and(
        eq(follows.fromUserId, defaults.user.id),
        eq(follows.toUserId, otherUser.id),
      ),
    );
  expect(newFollow).toBeDefined();
  expect(newFollow.status).toEqual(follow.status);
});

test("approves when mutual", async ({ defaults, fixtures }) => {
  const otherUser = await fixtures.User();
  await fixtures.Follow({
    fromUserId: otherUser.id,
    toUserId: defaults.user.id,
    status: "pending",
  });

  const caller = createCaller({ user: defaults.user });
  const data = await caller.friendCreate(otherUser.id);

  expect(data.status).toEqual("friends");

  const [follow] = await db
    .select()
    .from(follows)
    .where(
      and(
        eq(follows.fromUserId, defaults.user.id),
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
