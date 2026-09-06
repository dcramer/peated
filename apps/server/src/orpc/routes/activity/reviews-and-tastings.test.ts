import { db } from "@peated/server/db";
import { bottleTombstones, memberReviews } from "@peated/server/db/schema";
import { routerClient } from "@peated/server/orpc/router";

describe("GET /reviews-and-tastings", () => {
  test("interleaves all visible sources and keeps private member activity private", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const publicUser = await fixtures.User();
    const privateUser = await fixtures.User({ private: true });
    const publicTasting = await fixtures.Tasting({
      bottleId: bottle.id,
      createdById: publicUser.id,
      createdAt: new Date("2026-01-03T00:00:00Z"),
    });
    const privateTasting = await fixtures.Tasting({
      bottleId: bottle.id,
      createdById: privateUser.id,
      createdAt: new Date("2026-01-05T00:00:00Z"),
    });
    const [publicMemberReview, privateMemberReview] = await db
      .insert(memberReviews)
      .values([
        {
          bottleId: bottle.id,
          createdById: publicUser.id,
          score: 88,
          createdAt: new Date("2026-01-02T00:00:00Z"),
        },
        {
          bottleId: bottle.id,
          createdById: privateUser.id,
          score: 90,
          createdAt: new Date("2026-01-04T00:00:00Z"),
        },
      ])
      .returning();
    const criticReview = await fixtures.ExternalReview({
      bottleId: bottle.id,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    const hiddenCriticReview = await fixtures.ExternalReview({
      bottleId: bottle.id,
      hidden: true,
      createdAt: new Date("2026-01-06T00:00:00Z"),
    });

    const anonymous = await routerClient.activity.reviewsAndTastings({
      bottle: bottle.id,
    });

    expect(
      anonymous.results.map((item) => [
        item.type,
        item.type === "tasting" ? item.tasting.id : item.review.id,
      ]),
    ).toEqual([
      ["tasting", publicTasting.id],
      ["member_review", publicMemberReview!.id],
      ["critic_review", criticReview.id],
    ]);
    expect(
      anonymous.results.flatMap((item) =>
        item.type === "critic_review" ? [item.review.id] : [],
      ),
    ).not.toContain(hiddenCriticReview.id);

    const privateView = await routerClient.activity.reviewsAndTastings(
      { bottle: bottle.id },
      { context: { user: privateUser } },
    );
    expect(
      privateView.results.map((item) =>
        item.type === "tasting" ? item.tasting.id : item.review.id,
      ),
    ).toEqual([
      privateTasting.id,
      privateMemberReview!.id,
      publicTasting.id,
      publicMemberReview!.id,
      criticReview.id,
    ]);
  });

  test("uses a stable cursor and Entity bottle scope", async ({ fixtures }) => {
    const distillery = await fixtures.Entity({ kind: "distillery" });
    const firstBottle = await fixtures.Bottle({
      distillerIds: [distillery.id],
    });
    const secondBottle = await fixtures.Bottle({
      distillerIds: [distillery.id],
    });
    const unrelatedBottle = await fixtures.Bottle();
    const user = await fixtures.User();
    const first = await fixtures.Tasting({
      bottleId: firstBottle.id,
      createdById: user.id,
      createdAt: new Date("2026-02-03T00:00:00Z"),
    });
    const [reviewAtSameTime] = await db
      .insert(memberReviews)
      .values({
        bottleId: secondBottle.id,
        createdById: user.id,
        score: 88,
        createdAt: new Date("2026-02-03T00:00:00Z"),
      })
      .returning();
    const second = await fixtures.Tasting({
      bottleId: secondBottle.id,
      createdById: user.id,
      createdAt: new Date("2026-02-02T00:00:00Z"),
    });
    await fixtures.Tasting({
      bottleId: unrelatedBottle.id,
      createdById: user.id,
      createdAt: new Date("2026-02-04T00:00:00Z"),
    });

    const firstPage = await routerClient.activity.reviewsAndTastings({
      entity: distillery.id,
      limit: 1,
    });
    expect(firstPage.results).toMatchObject([
      { type: "tasting", tasting: { id: first.id } },
    ]);
    expect(firstPage.rel.nextCursor).toEqual(expect.any(String));

    const secondPage = await routerClient.activity.reviewsAndTastings({
      entity: distillery.id,
      limit: 1,
      cursor: firstPage.rel.nextCursor!,
    });
    expect(secondPage.results).toMatchObject([
      { type: "member_review", review: { id: reviewAtSameTime!.id } },
    ]);
    expect(secondPage.rel.nextCursor).toEqual(expect.any(String));

    const thirdPage = await routerClient.activity.reviewsAndTastings({
      entity: distillery.id,
      limit: 1,
      cursor: secondPage.rel.nextCursor!,
    });
    expect(thirdPage.results).toMatchObject([
      { type: "tasting", tasting: { id: second.id } },
    ]);
    expect(thirdPage.rel.nextCursor).toBeNull();
  });

  test("includes Bottles connected through brand, bottler, or distiller", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({ kind: "distillery" });
    const brandBottle = await fixtures.Bottle({ brandId: entity.id });
    const bottlerBottle = await fixtures.Bottle({ bottlerId: entity.id });
    const distillerBottle = await fixtures.Bottle({
      distillerIds: [entity.id],
    });
    const unrelatedBottle = await fixtures.Bottle();
    const user = await fixtures.User();
    const related = await Promise.all(
      [brandBottle, bottlerBottle, distillerBottle].map((bottle, index) =>
        fixtures.Tasting({
          bottleId: bottle.id,
          createdById: user.id,
          createdAt: new Date(`2026-03-0${index + 1}T00:00:00Z`),
        }),
      ),
    );
    await fixtures.Tasting({
      bottleId: unrelatedBottle.id,
      createdById: user.id,
      createdAt: new Date("2026-03-04T00:00:00Z"),
    });

    const result = await routerClient.activity.reviewsAndTastings({
      entity: entity.id,
    });

    expect(
      result.results.map((item) =>
        item.type === "tasting" ? item.tasting.id : item.review.id,
      ),
    ).toEqual(expect.arrayContaining(related.map(({ id }) => id)));
    expect(result.results).toHaveLength(3);
  });

  test("rejects invalid scope and cursors", async ({ fixtures }) => {
    const bottle = await fixtures.Bottle();
    await expect(
      routerClient.activity.reviewsAndTastings({
        bottle: bottle.id,
        entity: 1,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      routerClient.activity.reviewsAndTastings({
        bottle: bottle.id,
        cursor: "not-a-cursor",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      routerClient.activity.reviewsAndTastings({ bottle: 2_147_483_647 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const replacement = await fixtures.Bottle();
    await db.insert(bottleTombstones).values({
      bottleId: bottle.id,
      newBottleId: replacement.id,
    });
    await expect(
      routerClient.activity.reviewsAndTastings({ bottle: bottle.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
