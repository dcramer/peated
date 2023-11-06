import { db } from "@peated/server/db";
import { bottleTags, tastings } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import buildFastify from "../app";
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
    tags: ["spiced", "caramel"],
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

  const tags = await db
    .select()
    .from(bottleTags)
    .where(eq(bottleTags.bottleId, tasting.bottleId));

  expect(tags.length).toBe(2);
  for (const tag of tags) {
    expect(tag.count).toBe(0);
  }
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
