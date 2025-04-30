import { db } from "@peated/server/db";
import { bottleTags, bottles, tastings } from "@peated/server/db/schema";
import { omit } from "@peated/server/lib/filter";
import waitError from "@peated/server/lib/test/waitError";
import { and, eq, gt } from "drizzle-orm";
import { createCaller } from "../trpc/router";

test("requires auth", async () => {
  const caller = createCaller({
    user: null,
  });
  const err = await waitError(caller.tastingUpdate({ tasting: 1 }));
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});

test("cannot update another users tasting", async ({ defaults, fixtures }) => {
  const caller = createCaller({
    user: defaults.user,
  });
  const tasting = await fixtures.Tasting();
  const err = await waitError(caller.tastingUpdate({ tasting: tasting.id }));
  expect(err).toMatchInlineSnapshot(`[TRPCError: Tasting not found.]`);
});

test("no changes", async ({ defaults, fixtures }) => {
  const tasting = await fixtures.Tasting({
    createdById: defaults.user.id,
  });

  const caller = createCaller({
    user: defaults.user,
  });
  const data = await caller.tastingUpdate({
    tasting: tasting.id,
  });

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
  const caller = createCaller({
    user: defaults.user,
  });
  const data = await caller.tastingUpdate({
    tasting: tasting.id,
    rating: 3.5,
  });

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
  const caller = createCaller({
    user: defaults.user,
  });
  const data = await caller.tastingUpdate({
    tasting: tasting.id,
    notes: "hello world",
  });

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
  const caller = createCaller({
    user: defaults.user,
  });
  const data = await caller.tastingUpdate({
    tasting: tasting.id,
    tags: [tag.name],
  });

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
        gt(bottleTags.count, 0),
      ),
    );

  expect(tagList.length).toEqual(1);
  expect(tagList[0].tag).toEqual(tag.name);
  expect(tagList[0].count).toEqual(1);
});
