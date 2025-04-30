import { createCaller } from "../trpc/router";

test("lists comments", async ({ fixtures }) => {
  const comment = await fixtures.Comment();
  await fixtures.Comment();

  const caller = createCaller({ user: null });
  const { results } = await caller.commentList({
    tasting: comment.tastingId,
  });

  expect(results.length).toBe(1);
  expect(results[0].id).toBe(comment.id);
});
