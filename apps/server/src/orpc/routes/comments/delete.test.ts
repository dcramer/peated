import { db } from "@peated/server/db";
import { comments } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("DELETE /comments/:id", () => {
  test("requires authentication", async () => {
    const err = await waitError(() => routerClient.comments.delete(1));
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized]`);
  });

  test("delete own", async ({ defaults, fixtures }) => {
    const comment = await fixtures.Comment({
      createdById: defaults.user.id,
    });

    await routerClient.comments.delete(comment.id, {
      context: { user: defaults.user },
    });

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

    const err = await waitError(() =>
      routerClient.comments.delete(comment.id, {
        context: { user: defaults.user },
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized]`);
  });
});
