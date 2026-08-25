import { db } from "@peated/server/db";
import type { User } from "@peated/server/db/schema";
import {
  bottleGroups,
  bottleTombstones,
  bottles,
  bottlesToDistillers,
} from "@peated/server/db/schema";
import { materializeBottleForGroup } from "@peated/server/lib/bottleIdentity";
import {
  createBottle,
  type BottleCreateInput,
} from "@peated/server/lib/createBottle";
import * as testFixtures from "@peated/server/lib/test/fixtures";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

type GroupMemberExact = Omit<
  Parameters<typeof testFixtures.BottleGroupMember>[0],
  "groupId"
>;

async function createGroup(
  user: User,
  stable: Partial<BottleCreateInput>,
  exacts: GroupMemberExact[],
) {
  const first = await createBottle({
    context: { user },
    input: { ...stable, ...exacts[0] },
  });
  if ("statedAge" in stable) {
    const statedAge = stable.statedAge ?? null;
    const materialized = materializeBottleForGroup({
      group: { ...first.group, statedAge },
      exact: {
        edition: first.bottle.edition,
        statedAge: exacts[0].statedAge ?? null,
        releaseYear: first.bottle.releaseYear,
        vintageYear: first.bottle.vintageYear,
        abv: first.bottle.abv,
        singleCask: first.bottle.singleCask,
        caskStrength: first.bottle.caskStrength,
        caskType: first.bottle.caskType,
        caskSize: first.bottle.caskSize,
        caskFill: first.bottle.caskFill,
      },
    });
    await db
      .update(bottleGroups)
      .set({ statedAge })
      .where(eq(bottleGroups.id, first.group.id));
    await db
      .update(bottles)
      .set(materialized)
      .where(eq(bottles.id, first.bottle.id));
    Object.assign(first.group, { statedAge });
    Object.assign(first.bottle, materialized);
  }
  for (const exact of exacts.slice(1)) {
    await testFixtures.BottleGroupMember({
      groupId: first.group.id,
      ...exact,
    });
  }
  return { first };
}

describe("GET /bottles/{bottle}/edit-context", () => {
  test("requires moderator access", async ({ defaults, fixtures }) => {
    const bottle = await fixtures.Bottle();
    for (const user of [null, defaults.user]) {
      const error = await waitError(
        routerClient.bottles.editContext(
          { bottle: bottle.id },
          { context: { user } },
        ),
      );
      expect(error).toMatchObject({ status: 401 });
    }
  });

  test("returns group-owned rich shared choices and Bottle-owned exact values", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity({ name: "Context Group Brand" });
    const bottler = await fixtures.Entity({
      name: "Context Group Bottler",
      type: ["bottler"],
    });
    const distillers = [
      await fixtures.Entity({ name: "Context Distiller A" }),
      await fixtures.Entity({ name: "Context Distiller B" }),
    ];
    const series = await fixtures.BottleSeries({
      name: "Context Series",
      brandId: brand.id,
    });
    const { first } = await createGroup(
      mod,
      {
        name: "Shared Context Label",
        statedAge: 12,
        brand: brand.id,
        bottler: bottler.id,
        distillers: distillers.map(({ id }) => id),
        series: series.id,
        category: "single_malt",
        flavorProfile: "peated",
      },
      [
        {
          edition: "Batch 1",
          statedAge: 12,
          abv: 46,
          naturalColor: true,
          nonChillFiltered: false,
          maltPhenolPpm: 101.4,
          releaseYear: 2025,
          description: "Selected Bottle content",
        },
        { edition: "Batch 2", statedAge: 14, abv: 48 },
      ],
    );
    const driftBrand = await fixtures.Entity({ name: "Drift Bottle Brand" });
    const driftBottler = await fixtures.Entity({
      name: "Drift Bottle Bottler",
      type: ["bottler"],
    });
    const driftDistiller = await fixtures.Entity({
      name: "Drift Bottle Distiller",
    });
    const driftSeries = await fixtures.BottleSeries({
      name: "Drift Bottle Series",
      brandId: driftBrand.id,
    });
    await db
      .update(bottles)
      .set({
        name: "Contaminating Exact Formatted Name - Batch 1",
        fullName:
          "Drift Bottle Brand Contaminating Exact Formatted Name - Batch 1",
        statedAge: 15,
        brandId: driftBrand.id,
        bottlerId: driftBottler.id,
        seriesId: driftSeries.id,
        category: "bourbon",
        flavorProfile: "light_delicate",
      })
      .where(eq(bottles.id, first.bottle.id));
    await db
      .delete(bottlesToDistillers)
      .where(eq(bottlesToDistillers.bottleId, first.bottle.id));
    await db.insert(bottlesToDistillers).values({
      bottleId: first.bottle.id,
      distillerId: driftDistiller.id,
    });

    const result = await routerClient.bottles.editContext(
      { bottle: first.bottle.id },
      { context: { user: mod } },
    );

    expect(result).toMatchObject({
      bottleId: first.bottle.id,
      totalBottles: 2,
      shared: {
        name: "Shared Context Label",
        statedAge: 12,
        brand: { id: brand.id, name: brand.name },
        bottler: { id: bottler.id, name: bottler.name },
        series: { id: series.id, name: series.name },
        category: "single_malt",
        flavorProfile: "peated",
      },
      exact: {
        edition: "Batch 1",
        statedAge: 15,
        abv: 46,
        naturalColor: true,
        nonChillFiltered: false,
        maltPhenolPpm: 101.4,
        releaseYear: 2025,
        description: "Selected Bottle content",
      },
    });
    expect(result).not.toHaveProperty("groupId");
    expect(result).not.toHaveProperty("exact.tastingNotes");
    expect(Object.keys(result.shared.brand)).toEqual(["id", "name"]);
    expect(Object.keys(result.shared.distillers[0]!)).toEqual(["id", "name"]);
    expect(result.shared.distillers.map(({ id }) => id)).toEqual(
      distillers.map(({ id }) => id).sort((a, b) => a - b),
    );
    expect(result.shared.name).not.toContain("Batch 1");
    expect(result.shared.brand.id).not.toBe(driftBrand.id);
    expect(result.shared.bottler?.id).not.toBe(driftBottler.id);
    expect(result.shared.series?.id).not.toBe(driftSeries.id);
    expect(result.shared.distillers).not.toContainEqual(
      expect.objectContaining({ id: driftDistiller.id }),
    );
  });

  test("exposes a differing non-null Bottle age as an exact override", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity({ name: "Inherited Age Brand" });
    const { first } = await createGroup(
      mod,
      { name: "Inherited Age", statedAge: 18, brand: brand.id },
      [{ edition: "Standard", statedAge: 21 }],
    );

    const result = await routerClient.bottles.editContext(
      { bottle: first.bottle.id },
      { context: { user: mod } },
    );

    expect(result.shared.statedAge).toBe(18);
    expect(result.exact.statedAge).toBe(21);
  });

  test("normalizes an inherited Bottle age to a null exact override", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity({ name: "Shared Age Brand" });
    const { first } = await createGroup(
      mod,
      { name: "Shared Age", statedAge: 18, brand: brand.id },
      [{ edition: "Standard", statedAge: 18 }],
    );

    const result = await routerClient.bottles.editContext(
      { bottle: first.bottle.id },
      { context: { user: mod } },
    );

    expect(result.shared.statedAge).toBe(18);
    expect(result.exact.statedAge).toBeNull();
  });

  test("maps missing Bottles to not found and inactive graphs to conflict", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const missing = await waitError(
      routerClient.bottles.editContext(
        { bottle: 999_999 },
        { context: { user: mod } },
      ),
    );
    expect(missing).toMatchObject({ status: 404 });

    const retired = await fixtures.Bottle({ name: "Retired Edit Context" });
    const replacement = await fixtures.Bottle({
      name: "Replacement Edit Context",
    });
    await db.insert(bottleTombstones).values({
      bottleId: retired.id,
      newBottleId: replacement.id,
    });
    const retiredError = await waitError(
      routerClient.bottles.editContext(
        { bottle: retired.id },
        { context: { user: mod } },
      ),
    );
    expect(retiredError).toMatchObject({ status: 409 });

    const missingGroup = await fixtures.LegacyBottle({
      name: "Missing Group Edit Context",
    });
    const missingGroupError = await waitError(
      routerClient.bottles.editContext(
        { bottle: missingGroup.id },
        { context: { user: mod } },
      ),
    );
    expect(missingGroupError).toMatchObject({ status: 409 });
  });
});
