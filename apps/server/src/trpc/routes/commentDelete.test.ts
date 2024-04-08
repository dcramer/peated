import { db } from "@peated/server/db";
import { comments } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { createCaller } from "../router";

test("requires authentication", async () => {
  const caller = createCaller({ user: null });
  expect(() => caller.commentDelete(1)).rejects.toThrowError(/UNAUTHORIZED/);
});

test("delete own", async ({ defaults, fixtures }) => {
  const comment = await fixtures.Comment({
    createdById: defaults.user.id,
  });

  const caller = createCaller({ user: defaults.user });
  await caller.commentDelete(comment.id);

  const [newComment] = await db
    .select()
    .from(comments)
    .where(eq(comments.id, comment.id));
  expect(newComment).toBeUndefined();
});

test("cannot delete others", async ({ defaults, fixtures }) => {
  const user = await fixtures.User();
  const comment = await fixtures.Comment({
    createdById: user.id,
  });

  const caller = createCaller({ user: defaults.user });
  expect(() => caller.commentDelete(comment.id)).rejects.toThrowError(
    /Cannot delete another user's comment/,
  );
});
