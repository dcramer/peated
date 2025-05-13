import { db } from "@peated/server/db";
import { comments, tastings } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { routerClient } from "../router";

describe("POST /comments", () => {
  test("requires auth", async () => {
    const err = await waitError(() =>
      routerClient.commentCreate({
        tasting: 1,
        comment: "Hello world!",
        createdAt: new Date().toISOString(),
      }),
    );
    expect(err).toMatchInlineSnapshot();
  });

  test("new comment", async ({ fixtures, defaults }) => {
    const tasting = await fixtures.Tasting();

    const data = await routerClient.commentCreate(
      {
        tasting: tasting.id,
        comment: "Hello world!",
        createdAt: new Date().toISOString(),
      },
      { context: { user: defaults.user } },
    );

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
});
