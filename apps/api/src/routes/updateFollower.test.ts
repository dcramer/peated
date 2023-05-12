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

test("cannot act others requests", async () => {
  const user = await Fixtures.User();
  const otherUser = await Fixtures.User();

  const follow = await Fixtures.Follow({
    fromUserId: otherUser.id,
    toUserId: user.id,
  });

  const response = await app.inject({
    method: "PUT",
    url: `/users/${otherUser.id}/followers/${user.id}`,
    payload: {
      action: "accept",
    },
    headers: await Fixtures.AuthenticatedHeaders({ user }),
  });

  expect(response).toRespondWith(403);
});

test("can accept request", async () => {
  const user = await Fixtures.User();
  const otherUser = await Fixtures.User();

  const follow = await Fixtures.Follow({
    fromUserId: otherUser.id,
    toUserId: user.id,
  });

  const response = await app.inject({
    method: "PUT",
    url: `/users/${user.id}/followers/${otherUser.id}`,
    payload: {
      action: "accept",
    },
    headers: await Fixtures.AuthenticatedHeaders({ user }),
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.status).toBe("following");
  expect(data.followsBack).toBe("none");

  const [newFollow] = await db
    .select()
    .from(follows)
    .where(
      and(eq(follows.toUserId, user.id), eq(follows.fromUserId, otherUser.id)),
    );
  expect(newFollow.status).toBe("following");
});
