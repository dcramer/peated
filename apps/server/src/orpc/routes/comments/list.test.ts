import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /tastings/:tasting/comments", () => {
  test("lists comments", async ({ fixtures }) => {
    const comment = await fixtures.Comment();
    await fixtures.Comment();

    const { results } = await routerClient.comments.list({
      tasting: comment.tastingId,
    });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(comment.id);
  });
});
