import { db } from "@peated/server/db";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("DELETE /tastings/:id/image", () => {
  test("requires authentication", async () => {
    const err = await waitError(() =>
      routerClient.tastings.imageDelete({
        tasting: 1,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("cannot delete another user's image", async ({ fixtures }) => {
    const user = await fixtures.User();
    const otherUser = await fixtures.User();
    const tasting = await fixtures.Tasting({ createdById: otherUser.id });

    const err = await waitError(() =>
      routerClient.tastings.imageDelete(
        {
          tasting: tasting.id,
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Cannot delete another user's tasting image.]`,
    );
  });

  test("deletes existing image", async ({ defaults, fixtures }) => {
    const tasting = await fixtures.Tasting({
      createdById: defaults.user.id,
      imageUrl: "http://example.com/image.png",
    });

    const data = await routerClient.tastings.imageDelete(
      {
        tasting: tasting.id,
      },
      { context: { user: defaults.user } },
    );

    expect(data.imageUrl).toBe(null);

    const newTasting = await db.query.tastings.findFirst({
      where: (tastings, { eq }) => eq(tastings.id, tasting.id),
    });

    expect(newTasting?.imageUrl).toBe(null);
  });
});
