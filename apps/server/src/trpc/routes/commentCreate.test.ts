import { db } from "@peated/server/db";
import { comments, tastings } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("requires auth", async () => {
  const caller = appRouter.createCaller({
    user: null,
  });
  expect(() =>
    caller.commentCreate({
      tasting: 1,
      comment: "Hello world!",
      createdAt: new Date().toISOString(),
    }),
  ).rejects.toThrowError(/UNAUTHORIZED/);
});

test("new comment", async () => {
  const tasting = await Fixtures.Tasting();

  const caller = appRouter.createCaller({
    user: DefaultFixtures.user,
  });
  const data = await caller.commentCreate({
    tasting: tasting.id,
    comment: "Hello world!",
    createdAt: new Date().toISOString(),
  });

  expect(data.id).toBeDefined();
  expect(data.comment).toBe("Hello world!");

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
