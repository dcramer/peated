import { db } from "@peated/server/db";
import { comments } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { createCaller } from "../router";

test("requires authentication", async () => {
  const caller = createCaller({ user: null });
  const err = await waitError(caller.commentDelete(1));
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
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
  const err = await waitError(caller.commentDelete(comment.id));
  expect(err).toMatchInlineSnapshot(
    `[TRPCError: Cannot delete another user's comment.]`,
  );
});
