import { db } from "@peated/server/db";
import {
  bottleReferences,
  externalReviews,
  storePrices,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("GET /admin/bottle-reference-audit", () => {
  test("requires administrator access", async ({ fixtures }) => {
    const moderator = await fixtures.User({ mod: true });
    await expect(
      waitError(
        routerClient.admin.referenceAudit({}, { context: { user: moderator } }),
      ),
    ).resolves.toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("reports deterministic signals and bounded consumer impact without mutation", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "SMWS" });
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "1.234",
      edition: "Hello World",
      statedAge: 12,
    });
    const sibling = await fixtures.BottleGroupMember({
      groupId: bottle.groupId,
      edition: "Foo Bar",
      statedAge: 13,
    });
    const reference = await fixtures.BottleReference({
      bottleId: bottle.id,
      name: "SMWS 1.234",
      assignmentSource: "legacy",
    });
    const canonicalReference = await fixtures.BottleReference({
      bottleId: bottle.id,
      name: "SMWS 1.234 stale canonical",
      assignmentSource: "canonical",
    });
    const price = await fixtures.StorePrice({
      bottleId: bottle.id,
      name: reference.name,
    });
    const review = await fixtures.ExternalReview({
      bottleId: bottle.id,
      name: reference.name,
    });
    const admin = await fixtures.User({ admin: true });

    const result = await routerClient.admin.referenceAudit(
      { reviewState: "unreviewed" },
      { context: { user: admin } },
    );
    const item = result.results.find(({ id }) => id === reference.id);

    expect(
      result.results.find(({ id }) => id === canonicalReference.id),
    ).toBeUndefined();
    expect(item).toMatchObject({
      bottle: { id: bottle.id },
      group: { id: bottle.groupId },
      impact: {
        prices: { count: 1, ids: [price.id] },
        reviews: { count: 1, ids: [review.id] },
      },
    });
    expect(item?.group.siblings).toContainEqual({
      id: sibling.id,
      fullName: sibling.fullName,
    });
    expect(item?.signals.map(({ kind }) => kind)).toEqual(
      expect.arrayContaining(["generic_prefix", "sibling_ambiguity"]),
    );

    await expect(
      db.query.bottleReferences.findFirst({
        where: eq(bottleReferences.id, reference.id),
      }),
    ).resolves.toMatchObject({ ignored: false, reviewedAt: null });
    await expect(
      db.query.storePrices.findFirst({ where: eq(storePrices.id, price.id) }),
    ).resolves.toMatchObject({ bottleId: bottle.id });
    await expect(
      db.query.externalReviews.findFirst({
        where: eq(externalReviews.id, review.id),
      }),
    ).resolves.toMatchObject({ bottleId: bottle.id });
  });
});
