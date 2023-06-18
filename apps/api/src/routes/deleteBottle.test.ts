import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import buildFastify from "../app";
import { db } from "../db";
import { bottles } from "../db/schema";
import * as Fixtures from "../lib/test/fixtures";

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildFastify();

  return async () => {
    app.close();
  };
});

test("deletes bottle", async () => {
  const user = await Fixtures.User({ admin: true });
  const bottle = await Fixtures.Bottle();

  const response = await app.inject({
    method: "DELETE",
    url: `/bottles/${bottle.id}`,
    headers: await Fixtures.AuthenticatedHeaders({ user }),
  });

  expect(response).toRespondWith(204);

  const [newBottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, bottle.id));
  expect(newBottle).toBeUndefined();
});

test("cannot delete without admin", async () => {
  const user = await Fixtures.User({ mod: true });
  const bottle = await Fixtures.Bottle({ createdById: user.id });

  const response = await app.inject({
    method: "DELETE",
    url: `/bottles/${bottle.id}`,
    headers: await Fixtures.AuthenticatedHeaders({ user }),
  });

  expect(response).toRespondWith(403);
});
