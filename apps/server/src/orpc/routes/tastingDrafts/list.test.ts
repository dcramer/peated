import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /tasting-drafts", () => {
  test("requires auth", async () => {
    const error = await waitError(() => routerClient.tastingDrafts.list({}));
    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("lists only my drafts, most recently saved first", async ({
    defaults,
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const older = await fixtures.TastingDraft({
      createdById: defaults.user.id,
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const newer = await fixtures.TastingDraft({
      createdById: defaults.user.id,
      bottleId: bottle.id,
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    await fixtures.TastingDraft();

    const { results, rel } = await routerClient.tastingDrafts.list(
      {},
      { context: { user: defaults.user } },
    );

    expect(results.map(({ id }) => id)).toEqual([newer.id, older.id]);
    expect(results[0].bottle).toMatchObject({ id: bottle.id });
    expect(results[1].bottle).toBeNull();
    expect(rel).toEqual({ nextCursor: null, prevCursor: null });
  });

  test("pages through drafts", async ({ defaults, fixtures }) => {
    for (const day of [1, 2, 3]) {
      await fixtures.TastingDraft({
        createdById: defaults.user.id,
        updatedAt: new Date(`2026-01-0${day}T00:00:00.000Z`),
      });
    }

    const first = await routerClient.tastingDrafts.list(
      { limit: 2 },
      { context: { user: defaults.user } },
    );
    expect(first.results).toHaveLength(2);
    expect(first.rel).toEqual({ nextCursor: 2, prevCursor: null });

    const second = await routerClient.tastingDrafts.list(
      { limit: 2, cursor: 2 },
      { context: { user: defaults.user } },
    );
    expect(second.results).toHaveLength(1);
    expect(second.rel).toEqual({ nextCursor: null, prevCursor: 1 });
  });

  test("rejects a page too large to look up", async ({ defaults }) => {
    const error = await waitError(() =>
      routerClient.tastingDrafts.list(
        { cursor: 1e21 },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchObject({ code: "BAD_REQUEST" });
  });
});
