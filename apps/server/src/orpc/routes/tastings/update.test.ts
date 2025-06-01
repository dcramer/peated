import { db } from "@peated/server/db";
import { bottleTags, bottles, tastings } from "@peated/server/db/schema";
import { omit } from "@peated/server/lib/filter";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq, gt } from "drizzle-orm";

describe("PUT /tastings/:tasting", () => {
  test("requires auth", async () => {
    const err = await waitError(routerClient.tastings.update({ tasting: 1 }));
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("cannot update another users tasting", async ({
    defaults,
    fixtures,
  }) => {
    const tasting = await fixtures.Tasting();
    const err = await waitError(
      routerClient.tastings.update(
        { tasting: tasting.id },
        { context: { user: defaults.user } }
      )
    );
    expect(err).toMatchInlineSnapshot(`[Error: Tasting not found.]`);
  });

  test("no changes", async ({ defaults, fixtures }) => {
    const tasting = await fixtures.Tasting({
      createdById: defaults.user.id,
    });

    const data = await routerClient.tastings.update(
      { tasting: tasting.id },
      { context: { user: defaults.user } }
    );

    expect(data.id).toBeDefined();

    const [newTasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, data.id));

    expect(tasting).toEqual(newTasting);
  });

  test("updates rating", async ({ defaults, fixtures }) => {
    const tasting = await fixtures.Tasting({
      createdById: defaults.user.id,
    });

    const data = await routerClient.tastings.update(
      {
        tasting: tasting.id,
        rating: 3.5,
      },
      { context: { user: defaults.user } }
    );

    expect(data.id).toBeDefined();

    const [newTasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, data.id));

    expect(omit(tasting, "rating")).toEqual(omit(newTasting, "rating"));
    expect(newTasting.rating).toEqual(3.5);

    const [bottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, newTasting.bottleId));
    expect(bottle.avgRating).toEqual(3.5);
  });

  test("updates notes", async ({ defaults, fixtures }) => {
    const tasting = await fixtures.Tasting({
      createdById: defaults.user.id,
    });

    const data = await routerClient.tastings.update(
      {
        tasting: tasting.id,
        notes: "hello world",
      },
      { context: { user: defaults.user } }
    );

    expect(data.id).toBeDefined();

    const [newTasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, data.id));

    expect(omit(tasting, "notes")).toEqual(omit(newTasting, "notes"));
    expect(newTasting.notes).toEqual("hello world");
  });

  test("updates tags", async ({ defaults, fixtures }) => {
    const tag = await fixtures.Tag();
    const tasting = await fixtures.Tasting({
      createdById: defaults.user.id,
    });

    const data = await routerClient.tastings.update(
      {
        tasting: tasting.id,
        tags: [tag.name],
      },
      { context: { user: defaults.user } }
    );

    expect(data.id).toBeDefined();

    const [newTasting] = await db
      .select()
      .from(tastings)
      .where(eq(tastings.id, data.id));

    expect(omit(tasting, "tags")).toEqual(omit(newTasting, "tags"));
    expect(newTasting.tags).toEqual([tag.name]);

    const tagList = await db
      .select()
      .from(bottleTags)
      .where(
        and(
          eq(bottleTags.bottleId, newTasting.bottleId),
          gt(bottleTags.count, 0)
        )
      );

    expect(tagList.length).toEqual(1);
    expect(tagList[0].tag).toEqual(tag.name);
    expect(tagList[0].count).toEqual(1);
  });
});
