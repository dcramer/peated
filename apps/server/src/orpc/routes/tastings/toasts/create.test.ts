import { db } from "@peated/server/db";
import { tastings, toasts } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("POST /tastings/:id/toast", () => {
  test("requires auth", async () => {
    const err = await waitError(() =>
      routerClient.tastings.toasts.create({
        id: 1,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("cannot toast self", async ({ defaults, fixtures }) => {
    const tasting = await fixtures.Tasting({
      createdById: defaults.user.id,
    });

    const err = await waitError(() =>
      routerClient.tastings.toasts.create(
        {
          id: tasting.id,
        },
        { context: { user: defaults.user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(
      `[Error: Cannot toast your own tasting.]`,
    );
  });

  test("new toast", async ({ defaults, fixtures }) => {
    const tasting = await fixtures.Tasting();

    await routerClient.tastings.toasts.create(
      {
        id: tasting.id,
      },
      { context: { user: defaults.user } },
    );

    const toastList = await db
      .select()
      .from(toasts)
      .where(eq(toasts.tastingId, tasting.id));

    expect(toastList.length).toBe(1);
    expect(toastList[0].createdById).toBe(defaults.user.id);

    const [updatedTasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, tasting.id));
    expect(updatedTasting.toasts).toBe(1);
  });

  test("already toasted", async ({ defaults, fixtures }) => {
    const tasting = await fixtures.Tasting({ toasts: 1 });
    await fixtures.Toast({
      tastingId: tasting.id,
      createdById: defaults.user.id,
    });

    await routerClient.tastings.toasts.create(
      {
        id: tasting.id,
      },
      { context: { user: defaults.user } },
    );

    const toastList = await db
      .select()
      .from(toasts)
      .where(eq(toasts.tastingId, tasting.id));

    expect(toastList.length).toBe(1);
    expect(toastList[0].createdById).toBe(defaults.user.id);

    const [updatedTasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, tasting.id));
    expect(updatedTasting.toasts).toBe(1);
  });
});
