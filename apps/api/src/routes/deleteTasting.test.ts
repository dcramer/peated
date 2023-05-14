import { eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import buildFastify from "../app";
import { db } from "../db";
import { tastings } from "../db/schema";
import * as Fixtures from "../lib/test/fixtures";

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildFastify();

  return async () => {
    app.close();
  };
});

test("delete own tasting", async () => {
  const tasting = await Fixtures.Tasting({
    createdById: DefaultFixtures.user.id,
  });

  const response = await app.inject({
    method: "DELETE",
    url: `/tastings/${tasting.id}`,
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(204);

  const [newTasting] = await db
    .select()
    .from(tastings)
    .where(eq(tastings.id, tasting.id));
  expect(newTasting).toBeUndefined();
});

test("cannot delete others tasting", async () => {
  const user = await Fixtures.User();
  const tasting = await Fixtures.Tasting({ createdById: user.id });

  const response = await app.inject({
    method: "DELETE",
    url: `/tastings/${tasting.id}`,
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(403);
});
