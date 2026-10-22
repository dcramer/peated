import { db } from "@peated/server/db";
import { wrongPhotoMatches } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("PATCH /wrong-photo-matches/{wrongPhotoMatch}", () => {
  test("requires auth", async ({ fixtures }) => {
    const match = await fixtures.WrongPhotoMatch();
    const bottle = await fixtures.Bottle();
    const error = await waitError(() =>
      routerClient.wrongPhotoMatches.update({
        wrongPhotoMatch: match.id,
        correctBottle: bottle.id,
      }),
    );
    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("saves the bottle I chose", async ({ defaults, fixtures }) => {
    const match = await fixtures.WrongPhotoMatch({
      createdById: defaults.user.id,
    });
    const bottle = await fixtures.Bottle();

    expect(
      await routerClient.wrongPhotoMatches.update(
        { wrongPhotoMatch: match.id, correctBottle: bottle.id },
        { context: { user: defaults.user } },
      ),
    ).toEqual({ id: match.id });

    expect(
      await db.query.wrongPhotoMatches.findFirst({
        where: eq(wrongPhotoMatches.id, match.id),
      }),
    ).toMatchObject({ correctBottleId: bottle.id });
  });

  test("cannot change another member's record", async ({
    defaults,
    fixtures,
  }) => {
    const match = await fixtures.WrongPhotoMatch();
    const bottle = await fixtures.Bottle();

    const error = await waitError(() =>
      routerClient.wrongPhotoMatches.update(
        { wrongPhotoMatch: match.id, correctBottle: bottle.id },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(
      `[Error: Wrong photo match not found.]`,
    );
    expect(
      await db.query.wrongPhotoMatches.findFirst({
        where: eq(wrongPhotoMatches.id, match.id),
      }),
    ).toMatchObject({ correctBottleId: null });
  });

  test("rejects a missing bottle", async ({ defaults, fixtures }) => {
    const match = await fixtures.WrongPhotoMatch({
      createdById: defaults.user.id,
    });

    const error = await waitError(() =>
      routerClient.wrongPhotoMatches.update(
        { wrongPhotoMatch: match.id, correctBottle: 999_999_999 },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Bottle not found.]`);
  });
});
