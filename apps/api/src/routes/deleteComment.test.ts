import { db } from "@peated/core/db";
import { comments } from "@peated/core/db/schema";
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

test("delete own", async () => {
  const comment = await Fixtures.Comment({
    createdById: DefaultFixtures.user.id,
  });

  const response = await app.inject({
    method: "DELETE",
    url: `/comments/${comment.id}`,
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(204);

  const [newComment] = await db
    .select()
    .from(comments)
    .where(eq(comments.id, comment.id));
  expect(newComment).toBeUndefined();
});

test("cannot delete others", async () => {
  const user = await Fixtures.User();
  const comment = await Fixtures.Comment({
    createdById: user.id,
  });
  const response = await app.inject({
    method: "DELETE",
    url: `/comments/${comment.id}`,
    headers: DefaultFixtures.authHeaders,
  });

  expect(response).toRespondWith(403);
});
