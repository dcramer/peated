import { eq } from "drizzle-orm";
import { FastifyInstance } from "fastify";
import buildFastify from "../app";
import { db } from "../db";
import { tastings, toasts } from "../db/schema";
import * as Fixtures from "../lib/test/fixtures";

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildFastify();

  return async () => {
    await app.close();
  };
});

test("cannot toast self", async () => {
  const tasting = await Fixtures.Tasting({
    createdById: DefaultFixtures.user.id,
  });
  const response = await app.inject({
    method: "POST",
    url: `/tastings/${tasting.id}/toasts`,
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(400);
});

test("new toast", async () => {
  const tasting = await Fixtures.Tasting();
  const response = await app.inject({
    method: "POST",
    url: `/tastings/${tasting.id}/toasts`,
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);

  const toastList = await db
    .select()
    .from(toasts)
    .where(eq(toasts.tastingId, tasting.id));

  expect(toastList.length).toBe(1);
  expect(toastList[0].createdById).toBe(DefaultFixtures.user.id);

  const [updatedTasting] = await db
    .select()
    .from(tastings)
    .where(eq(tastings.id, tasting.id));
  expect(updatedTasting.toasts).toBe(1);
});

test("already toasted", async () => {
  const tasting = await Fixtures.Tasting();
  await Fixtures.Toast({
    tastingId: tasting.id,
    createdById: DefaultFixtures.user.id,
  });
  const response = await app.inject({
    method: "POST",
    url: `/tastings/${tasting.id}/toasts`,
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);

  const toastList = await db
    .select()
    .from(toasts)
    .where(eq(toasts.tastingId, tasting.id));

  expect(toastList.length).toBe(1);
  expect(toastList[0].createdById).toBe(DefaultFixtures.user.id);
});
