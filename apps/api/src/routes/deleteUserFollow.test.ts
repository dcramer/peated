import { and, eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import buildFastify from "../app";
import { db } from "../db";
import { follows } from "../db/schema";
import * as Fixtures from "../lib/test/fixtures";

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildFastify();

  return async () => {
    await app.close();
  };
});

test("cannot unfollow self", async () => {
  const response = await app.inject({
    method: "DELETE",
    url: `/users/${DefaultFixtures.user.id}/follow`,
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(400);
});

test("can unfollow new link", async () => {
  const otherUser = await Fixtures.User();

  const response = await app.inject({
    method: "DELETE",
    url: `/users/${otherUser.id}/follow`,
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.status).toBe("none");

  const [follow] = await db
    .select()
    .from(follows)
    .where(
      and(
        eq(follows.fromUserId, DefaultFixtures.user.id),
        eq(follows.toUserId, otherUser.id),
      ),
    );
  expect(follow).toBeUndefined();
});

test("can unfollow existing link", async () => {
  const otherUser = await Fixtures.User();

  await Fixtures.Follow({
    fromUserId: DefaultFixtures.user.id,
    toUserId: otherUser.id,
  });

  const response = await app.inject({
    method: "DELETE",
    url: `/users/${otherUser.id}/follow`,
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.status).toBe("none");

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
  expect(follow.status).toBe("none");
});
