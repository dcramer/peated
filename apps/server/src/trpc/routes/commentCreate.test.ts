import { db } from "@peated/server/db";
import { comments, tastings } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { createCaller } from "../router";

test("requires auth", async () => {
  const caller = createCaller({
    user: null,
  });
  const err = await waitError(
    caller.commentCreate({
      tasting: 1,
      comment: "Hello world!",
      createdAt: new Date().toISOString(),
    }),
  );
  expect(err).toMatchInlineSnapshot();
});

test("new comment", async ({ fixtures, defaults }) => {
  const tasting = await fixtures.Tasting();

  const caller = createCaller({
    user: defaults.user,
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
  expect(commentList[0].createdById).toBe(defaults.user.id);
  expect(commentList[0].comment).toBe("Hello world!");

  const [updatedTasting] = await db
    .select()
    .from(tastings)
    .where(eq(tastings.id, tasting.id));
  expect(updatedTasting.comments).toBe(1);
});
