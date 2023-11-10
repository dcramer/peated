import { db } from "@peated/server/db";
import { comments } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("requires authentication", async () => {
  const caller = appRouter.createCaller({ user: null });
  expect(() => caller.commentDelete(1)).rejects.toThrowError(/UNAUTHORIZED/);
});

test("delete own", async () => {
  const comment = await Fixtures.Comment({
    createdById: DefaultFixtures.user.id,
  });

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  await caller.commentDelete(comment.id);

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

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  expect(() => caller.commentDelete(comment.id)).rejects.toThrowError(
    /Cannot delete another user's comment/,
  );
});
