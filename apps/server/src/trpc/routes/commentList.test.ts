import * as Fixtures from "../../lib/test/fixtures";
import { createCaller } from "../router";

test("lists comments", async () => {
  const comment = await Fixtures.Comment();
  await Fixtures.Comment();

  const caller = createCaller({ user: null });
  const { results } = await caller.commentList({
    tasting: comment.tastingId,
  });

  expect(results.length).toBe(1);
  expect(results[0].id).toBe(comment.id);
});
