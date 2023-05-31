import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import buildFastify from "../app";
import { db } from "../db";
import { follows, notifications } from "../db/schema";
import { objectTypeFromSchema } from "../lib/notifications";
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
    url: `/users/${DefaultFixtures.user.id}/follow`,
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(400);
});

test("can follow new link", async () => {
  const otherUser = await Fixtures.User();

  const response = await app.inject({
    method: "POST",
    url: `/users/${otherUser.id}/follow`,
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
        eq(notifications.objectType, objectTypeFromSchema(follows)),
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
    url: `/users/${otherUser.id}/follow`,
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.status).toBe("following");

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

test("automatically approves follow when mutual", async () => {
  const otherUser = await Fixtures.User();
  await Fixtures.Follow({
    fromUserId: otherUser.id,
    toUserId: DefaultFixtures.user.id,
    status: "following",
  });

  const response = await app.inject({
    method: "POST",
    url: `/users/${otherUser.id}/follow`,
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.status).toBe("following");

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
        eq(notifications.objectType, objectTypeFromSchema(follows)),
      ),
    );

  expect(notif).toBeUndefined();
});
