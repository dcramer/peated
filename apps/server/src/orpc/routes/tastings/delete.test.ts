import { db } from "@peated/server/db";
import { bottleTags, tastings } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("DELETE /tastings/:tasting", () => {
  test("requires authentication", async () => {
    const err = await waitError(() =>
      routerClient.tastings.delete({ tasting: 1 })
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("delete own tasting", async ({ defaults, fixtures }) => {
    const tasting = await fixtures.Tasting({
      createdById: defaults.user.id,
      tags: ["spiced", "caramel"],
    });

    await routerClient.tastings.delete(
      { tasting: tasting.id },
      {
        context: { user: defaults.user },
      }
    );

    const [newTasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, tasting.id));
    expect(newTasting).toBeUndefined();

    const tags = await db
      .select()
      .from(bottleTags)
      .where(eq(bottleTags.bottleId, tasting.bottleId));

    expect(tags.length).toBe(2);
    for (const tag of tags) {
      expect(tag.count).toBe(0);
    }
  });

  test("cannot delete others tasting", async ({ defaults, fixtures }) => {
    const user = await fixtures.User();
    const tasting = await fixtures.Tasting({ createdById: user.id });

    const err = await waitError(() =>
      routerClient.tastings.delete(
        { tasting: tasting.id },
        {
          context: { user: defaults.user },
        }
      )
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Cannot delete another user's tasting.]`
    );
  });
});
