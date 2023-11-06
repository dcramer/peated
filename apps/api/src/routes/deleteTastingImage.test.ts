import { db } from "@peated/core/db";
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

test("cannot delete another users image", async () => {
  const user = await Fixtures.User();
  const otherUser = await Fixtures.User();
  const tasting = await Fixtures.Tasting({ createdById: otherUser.id });

  const response = await app.inject({
    method: "DELETE",
    url: `/tastings/${tasting.id}/image`,
    payload: {},
    headers: await Fixtures.AuthenticatedHeaders({ user }),
  });

  expect(response).toRespondWith(403);
});

test("deletes existing image", async () => {
  const tasting = await Fixtures.Tasting({
    createdById: DefaultFixtures.user.id,
    imageUrl: "http://example.com/image.png",
  });

  const response = await app.inject({
    method: "DELETE",
    url: `/tastings/${tasting.id}/image`,
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);
  const data = JSON.parse(response.payload);
  expect(data.imageUrl).toBe(null);

  const newTasting = await db.query.tastings.findFirst({
    where: (tastings, { eq }) => eq(tastings.id, tasting.id),
  });

  expect(newTasting?.imageUrl).toBe(null);
});
