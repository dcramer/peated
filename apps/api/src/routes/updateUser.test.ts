import { db } from "@peated/shared/db";
import { users } from "@peated/shared/db/schema";
import { eq } from "drizzle-orm";
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

test("cannot update another user", async () => {
  const user = await Fixtures.User();
  const otherUser = await Fixtures.User();

  const response = await app.inject({
    method: "PUT",
    url: `/users/${otherUser.id}`,
    payload: {
      displayName: "Joe",
    },
    headers: await Fixtures.AuthenticatedHeaders({ user }),
  });

  expect(response).toRespondWith(403);
});

test("can change displayName", async () => {
  const response = await app.inject({
    method: "PUT",
    url: `/users/${DefaultFixtures.user.id}`,
    payload: {
      displayName: "Joe",
    },
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, DefaultFixtures.user.id));
  expect(user.displayName).toEqual("Joe");
});

test("can change username", async () => {
  const response = await app.inject({
    method: "PUT",
    url: `/users/${DefaultFixtures.user.id}`,
    payload: {
      username: "JoeBlow",
    },
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.id).toBeDefined();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, DefaultFixtures.user.id));
  expect(user.username).toEqual("joeblow");
});
