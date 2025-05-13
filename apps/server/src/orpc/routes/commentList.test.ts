import { describe, expect, test } from "vitest";
import { routerClient } from "../router";

describe("GET /comments", () => {
  test("lists comments", async ({ fixtures }) => {
    const comment = await fixtures.Comment();
    await fixtures.Comment();

    const { results } = await routerClient.commentList({
      tasting: comment.tastingId,
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(comment.id);
  });
});
