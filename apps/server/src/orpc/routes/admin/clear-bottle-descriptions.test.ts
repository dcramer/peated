import { db } from "@peated/server/db";
import { bottles, bottleTombstones, changes } from "@peated/server/db/schema";
import * as workerClient from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import { and, asc, eq } from "drizzle-orm";

async function descriptions() {
  const rows = await db
    .select({
      id: bottles.id,
      name: bottles.name,
      fullName: bottles.fullName,
      description: bottles.description,
      descriptionSrc: bottles.descriptionSrc,
    })
    .from(bottles)
    .orderBy(asc(bottles.id));
  return new Map(rows.map((row) => [row.id, row]));
}

describe("POST /admin/catalog/clear-bottle-descriptions", () => {
  beforeEach(() => {
    vi.mocked(workerClient.pushJob).mockClear();
  });

  test("dry run lists generated descriptions and changes nothing", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const generated = await fixtures.Bottle({
      description: "A smooth and approachable dram.",
      descriptionSrc: "generated",
    });
    await fixtures.Bottle({
      description: "Copied from the distillery's product page.",
      descriptionSrc: "user",
    });
    await fixtures.Bottle({
      description: "Written before Peated recorded who wrote it.",
      descriptionSrc: null,
    });
    const before = await descriptions();
    vi.mocked(workerClient.pushJob).mockClear();

    const result = await routerClient.admin.clearBottleDescriptions(
      { dryRun: true },
      { context: { user: admin } },
    );

    expect(result).toEqual({
      bottleIds: [generated.id],
      conflicts: [],
      checked: 1,
      remaining: 1,
      nextAfterId: null,
    });
    expect(await descriptions()).toEqual(before);
    expect(workerClient.pushJob).not.toHaveBeenCalled();
  });

  test("clears only generated descriptions and records each change", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const generated = await fixtures.Bottle({
      description: "A smooth and approachable dram.",
      descriptionSrc: "generated",
    });
    const person = await fixtures.Bottle({
      description: "Copied from the distillery's product page.",
      descriptionSrc: "user",
    });
    const unknown = await fixtures.Bottle({
      description: "Written before Peated recorded who wrote it.",
      descriptionSrc: null,
    });
    const before = await descriptions();
    vi.mocked(workerClient.pushJob).mockClear();

    const result = await routerClient.admin.clearBottleDescriptions(
      {},
      { context: { user: admin } },
    );

    expect(result).toEqual({
      bottleIds: [generated.id],
      conflicts: [],
      checked: 1,
      remaining: 1,
      nextAfterId: null,
    });
    const after = await descriptions();
    expect(after.get(generated.id)).toEqual({
      ...before.get(generated.id),
      description: null,
      descriptionSrc: null,
    });
    expect(after.get(person.id)).toEqual(before.get(person.id));
    expect(after.get(unknown.id)).toEqual(before.get(unknown.id));

    const updates = await db
      .select({ data: changes.data })
      .from(changes)
      .where(
        and(
          eq(changes.objectType, "bottle"),
          eq(changes.objectId, generated.id),
          eq(changes.type, "update"),
        ),
      );
    expect(updates).toHaveLength(1);
    expect(updates[0]!.data).toMatchObject({
      description: null,
      descriptionSrc: null,
      before: {
        description: "A smooth and approachable dram.",
        descriptionSrc: "generated",
      },
    });
    expect(workerClient.pushJob).toHaveBeenCalledWith("OnBottleChange", {
      bottleId: generated.id,
    });
  });

  test("skips retired Bottles", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const retired = await fixtures.Bottle({
      description: "A smooth and approachable dram.",
      descriptionSrc: "generated",
    });
    const replacement = await fixtures.Bottle();
    await db.insert(bottleTombstones).values({
      bottleId: retired.id,
      newBottleId: replacement.id,
    });

    const result = await routerClient.admin.clearBottleDescriptions(
      {},
      { context: { user: admin } },
    );

    expect(result).toMatchObject({ bottleIds: [], remaining: 0 });
    expect((await descriptions()).get(retired.id)?.description).toBe(
      "A smooth and approachable dram.",
    );
  });

  test("pages through Bottles with nextAfterId", async ({ fixtures }) => {
    const admin = await fixtures.User({ admin: true });
    const first = await fixtures.Bottle({
      description: "First generated text.",
      descriptionSrc: "generated",
    });
    const second = await fixtures.Bottle({
      description: "Second generated text.",
      descriptionSrc: "generated",
    });

    const firstPage = await routerClient.admin.clearBottleDescriptions(
      { limit: 1 },
      { context: { user: admin } },
    );
    expect(firstPage).toEqual({
      bottleIds: [first.id],
      conflicts: [],
      checked: 1,
      remaining: 2,
      nextAfterId: first.id,
    });

    const secondPage = await routerClient.admin.clearBottleDescriptions(
      { afterId: firstPage.nextAfterId!, limit: 1 },
      { context: { user: admin } },
    );
    expect(secondPage).toEqual({
      bottleIds: [second.id],
      conflicts: [],
      checked: 1,
      remaining: 1,
      nextAfterId: null,
    });
  });

  test("skips a Bottle that duplicates another and reports the pair", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const brand = await fixtures.Entity({ kind: "brand" });
    const original = await fixtures.Bottle({
      brandId: brand.id,
      description: "First generated text.",
      descriptionSrc: "user",
    });
    const duplicate = await fixtures.Bottle({
      brandId: brand.id,
      description: "A smooth and approachable dram.",
      descriptionSrc: "generated",
    });
    // Old data: two Bottles with the same identity. The save path refuses to
    // create this pair, so the test copies the identity fields directly.
    const [identity] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, original.id));
    await db
      .update(bottles)
      .set({
        name: identity!.name,
        fullName: identity!.fullName,
        seriesId: identity!.seriesId,
        edition: identity!.edition,
        statedAge: identity!.statedAge,
        noAgeStatement: identity!.noAgeStatement,
        vintageYear: identity!.vintageYear,
        bottlingYear: identity!.bottlingYear,
        releaseYear: identity!.releaseYear,
        releaseMonth: identity!.releaseMonth,
        releaseDay: identity!.releaseDay,
        abv: identity!.abv,
        singleCask: identity!.singleCask,
        caskStrength: identity!.caskStrength,
        caskNumber: identity!.caskNumber,
        outturn: identity!.outturn,
      })
      .where(eq(bottles.id, duplicate.id));

    const result = await routerClient.admin.clearBottleDescriptions(
      {},
      { context: { user: admin } },
    );

    expect(result).toMatchObject({
      bottleIds: [],
      conflicts: [{ bottleId: duplicate.id, conflictingBottleId: original.id }],
    });
    expect((await descriptions()).get(duplicate.id)?.description).toBe(
      "A smooth and approachable dram.",
    );
  });

  test("requires administrator access", async ({ fixtures }) => {
    const moderator = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle({
      description: "A smooth and approachable dram.",
      descriptionSrc: "generated",
    });

    await expect(
      routerClient.admin.clearBottleDescriptions(
        {},
        { context: { user: moderator } },
      ),
    ).rejects.toThrow();
    expect((await descriptions()).get(bottle.id)?.description).toBe(
      "A smooth and approachable dram.",
    );
  });
});
