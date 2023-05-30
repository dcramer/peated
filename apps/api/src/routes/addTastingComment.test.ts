import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import buildFastify from "../app";
import { db } from "../db";
import { comments, tastings } from "../db/schema";
import * as Fixtures from "../lib/test/fixtures";

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildFastify();

  return async () => {
    await app.close();
  };
});

test("new comment", async () => {
  const tasting = await Fixtures.Tasting();
  const response = await app.inject({
    method: "POST",
    url: `/tastings/${tasting.id}/comments`,
    payload: {
      comment: "Hello world!",
      createdAt: new Date().toISOString(),
    },
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(200);

  const commentList = await db
    .select()
    .from(comments)
    .where(eq(comments.tastingId, tasting.id));

  expect(commentList.length).toBe(1);
  expect(commentList[0].createdById).toBe(DefaultFixtures.user.id);
  expect(commentList[0].comment).toBe("Hello world!");

  const [updatedTasting] = await db
    .select()
    .from(tastings)
    .where(eq(tastings.id, tasting.id));
  expect(updatedTasting.comments).toBe(1);
});
