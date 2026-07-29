import { db } from "@peated/server/db";
import { bottleTags, tastings } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import * as workerClient from "@peated/server/worker/client";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@peated/server/worker/client", async (importOriginal) => ({
  ...(await importOriginal<typeof workerClient>()),
  pushJob: vi.fn().mockResolvedValue(undefined),
}));

describe("DELETE /tastings/{tasting}", () => {
  beforeEach(() => {
    vi.mocked(workerClient.pushJob).mockReset().mockResolvedValue(undefined);
  });

  test("requires authentication", async () => {
    const error = await waitError(() =>
      routerClient.tastings.delete({ tasting: 1 }),
    );
    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("deletes an owned Tasting using its direct Bottle", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const tasting = await fixtures.Tasting({
      bottleId: bottle.id,
      createdById: defaults.user.id,
      tags: ["caramel"],
    });

    await routerClient.tastings.delete(
      { tasting: tasting.id },
      { context: { user: defaults.user } },
    );

    expect(
      await db.query.tastings.findFirst({
        where: eq(tastings.id, tasting.id),
      }),
    ).toBeUndefined();
    expect(
      await db.query.bottleTags.findFirst({
        where: (tags, { and, eq }) =>
          and(eq(tags.bottleId, bottle.id), eq(tags.tag, "caramel")),
      }),
    ).toMatchObject({ count: 0 });
    expect(workerClient.pushJob).toHaveBeenCalledWith(
      "UpdateBottleStats",
      { bottleId: bottle.id },
      {
        delay: 5000,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  });

  test("cannot delete another user's Tasting", async ({
    defaults,
    fixtures,
  }) => {
    const tasting = await fixtures.Tasting();
    const error = await waitError(
      routerClient.tastings.delete(
        { tasting: tasting.id },
        { context: { user: defaults.user } },
      ),
    );
    expect(error).toMatchInlineSnapshot(
      `[Error: Cannot delete another user's tasting.]`,
    );
  });
});
