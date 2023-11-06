import { db } from "@peated/core/db";
import { follows, notifications } from "@peated/core/db/schema";
import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import buildFastify from "../app";
import * as Fixtures from "../lib/test/fixtures";

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildFastify();

  return async () => {
    await app.close();
  };
});

test("cannot follow self", async () => {
  const response = await app.inject({
    method: "POST",
    url: `/friends/${DefaultFixtures.user.id}`,
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(400);
});

test("can follow new link", async () => {
  const otherUser = await Fixtures.User();

  const response = await app.inject({
    method: "POST",
    url: `/friends/${otherUser.id}`,
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.status).toBe("pending");

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
  expect(notif.fromUserId).toBe(follow.fromUserId);
  expect(notif.userId).toBe(follow.toUserId);
});

test("can follow existing link", async () => {
  const otherUser = await Fixtures.User();

  const follow = await Fixtures.Follow({
    fromUserId: DefaultFixtures.user.id,
    toUserId: otherUser.id,
    status: "following",
  });

  const response = await app.inject({
    method: "POST",
    url: `/friends/${otherUser.id}`,
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.status).toBe("friends");

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
  expect(newFollow.status).toBe(follow.status);
});

test("approves when mutual", async () => {
  const otherUser = await Fixtures.User();
  await Fixtures.Follow({
    fromUserId: otherUser.id,
    toUserId: DefaultFixtures.user.id,
    status: "pending",
  });

  const response = await app.inject({
    method: "POST",
    url: `/friends/${otherUser.id}`,
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.status).toBe("friends");

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
  expect(follow.status).toBe("following");

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
