import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /admin/wrong-photo-matches", () => {
  test("requires an administrator", async ({ fixtures }) => {
    const mod = await fixtures.User({ mod: true });
    const error = await waitError(() =>
      routerClient.admin.wrongPhotoMatches.list({}, { context: { user: mod } }),
    );
    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("lists newest first with both bottles", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const wrongBottle = await fixtures.Bottle();
    const correctBottle = await fixtures.Bottle();
    const older = await fixtures.WrongPhotoMatch({
      wrongBottleId: wrongBottle.id,
      createdAt: new Date(Date.now() - 60_000),
    });
    const newer = await fixtures.WrongPhotoMatch({
      wrongBottleId: wrongBottle.id,
      correctBottleId: correctBottle.id,
      traceId: "55bb2bc6ccd4469db54e89b1d32368e6",
    });

    const { results, rel } = await routerClient.admin.wrongPhotoMatches.list(
      {},
      { context: { user: admin } },
    );

    expect(results.map((match) => match.id)).toEqual([newer.id, older.id]);
    expect(results[0]).toMatchObject({
      imageUrl: expect.stringContaining("/uploads/wrong-photo-matches/"),
      imageEvidence: newer.imageEvidence,
      wrongBottle: { id: wrongBottle.id },
      correctBottle: { id: correctBottle.id },
      traceId: "55bb2bc6ccd4469db54e89b1d32368e6",
    });
    expect(results[1]).toMatchObject({ correctBottle: null });
    expect(rel).toEqual({ nextCursor: null, prevCursor: null });
  });
});
