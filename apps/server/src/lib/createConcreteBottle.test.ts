import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleGroupDistillers,
  bottleGroupTombstones,
  bottleGroups,
  bottleTombstones,
  bottles,
  bottlesToDistillers,
  changes,
} from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import { buildClassifierConcreteBottleInput } from "@peated/server/lib/classifierDecisionCreateInputs";
import {
  BottleAlreadyExistsError,
  createOrReuseConcreteBottleInTransaction,
} from "@peated/server/lib/createBottle";
import {
  ConcreteBottleCreateInputSchema,
  createConcreteBottle,
  createConcreteBottleInTransaction,
} from "@peated/server/lib/createConcreteBottle";
import { normalizeBottleAliasKey } from "@peated/server/lib/normalize";
import { updateConcreteBottle } from "@peated/server/lib/updateConcreteBottle";
import * as workerClient from "@peated/server/worker/client";
import { and, eq } from "drizzle-orm";
import { vi } from "vitest";

function contextFor(user: Parameters<typeof getUserActor>[0]) {
  return { user } as Parameters<typeof createConcreteBottle>[0]["context"];
}

describe("concrete Bottle creation", () => {
  test("creates an atomic singleton graph with stable and exact field ownership", async ({
    defaults,
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Creation Test Brand" });
    const bottler = await fixtures.Entity({
      name: "Creation Test Bottler",
      type: ["bottler"],
    });
    const distiller = await fixtures.Entity({
      name: "Creation Test Distillery",
    });
    const series = await fixtures.BottleSeries({ brandId: brand.id });
    const stableCompatibilityFields = {
      brandId: brand.id,
      bottlerId: bottler.id,
      seriesId: series.id,
      category: "single_malt" as const,
      flavorProfile: "peated" as const,
    };

    const result = await createConcreteBottle({
      context: contextFor(defaults.user),
      input: {
        stable: {
          name: "Cask Strength",
          statedAge: 12,
          brand: brand.id,
          bottler: bottler.id,
          distillers: [distiller.id],
          series: series.id,
          category: "single_malt",
          flavorProfile: "peated",
        },
        exact: {
          edition: "Batch 24",
          statedAge: 13,
          releaseYear: 2026,
          abv: 55.4,
          caskStrength: true,
          description: "Exact release content",
        },
      },
    });

    expect(result.bottle).toMatchObject({
      ...stableCompatibilityFields,
      groupId: result.group.id,
      name: "Cask Strength - Batch 24 - 13-year-old - 2026 Release - 55.4% ABV",
      fullName:
        "Creation Test Brand Cask Strength - Batch 24 - 13-year-old - 2026 Release - 55.4% ABV",
      edition: "Batch 24",
      statedAge: 13,
      releaseYear: 2026,
      abv: 55.4,
      description: "Exact release content",
    });
    expect(result.group).toMatchObject({
      ...stableCompatibilityFields,
      name: "Cask Strength",
      fullName: "Creation Test Brand Cask Strength",
      statedAge: 12,
      description: null,
      totalBottles: 1,
      representativeBottleId: result.bottle.id,
    });
    expect(Object.keys(result).sort()).toEqual(["bottle", "group"]);

    const [alias] = await db
      .select()
      .from(bottleAliases)
      .where(eq(bottleAliases.bottleId, result.bottle.id));
    expect(alias).toMatchObject({
      assignmentSource: "canonical",
    });

    const groupDistillers = await db
      .select()
      .from(bottleGroupDistillers)
      .where(eq(bottleGroupDistillers.groupId, result.group.id));
    const bottleDistillers = await db
      .select()
      .from(bottlesToDistillers)
      .where(eq(bottlesToDistillers.bottleId, result.bottle.id));
    expect(groupDistillers.map(({ distillerId }) => distillerId)).toEqual([
      distiller.id,
    ]);
    expect(bottleDistillers.map(({ distillerId }) => distillerId)).toEqual([
      distiller.id,
    ]);

    const [change] = await db
      .select()
      .from(changes)
      .where(
        and(
          eq(changes.objectType, "bottle"),
          eq(changes.objectId, result.bottle.id),
        ),
      );
    expect(change).toMatchObject({
      actorId: result.bottle.createdByActorId,
      displayName: result.bottle.fullName,
      type: "add",
    });
  });

  test("owns normalized and literal canonical aliases and queues both after commit", async ({
    defaults,
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Literal™ Alias Brand" });
    const queuedAliases: string[] = [];
    let failedAliasName: string | null = null;
    vi.mocked(workerClient.pushUniqueJob).mockImplementation(
      async (jobName, args) => {
        if (jobName !== "OnBottleAliasChange") return;

        const name = (args as { name: string }).name;
        const [persistedAlias] = await db
          .select()
          .from(bottleAliases)
          .where(eq(bottleAliases.name, name));
        expect(persistedAlias).toMatchObject({
          name,
          assignmentSource: "canonical",
          ignored: false,
        });
        queuedAliases.push(name);
        if (failedAliasName === null) {
          failedAliasName = name;
          throw new Error("alias queue unavailable");
        }
      },
    );

    const result = await createConcreteBottle({
      context: contextFor(defaults.user),
      input: {
        stable: { name: "Canonical Alias", brand: brand.id },
        exact: {},
      },
    });

    const literalName = result.bottle.fullName;
    const normalizedName = normalizeBottleAliasKey(literalName);
    expect(normalizedName).not.toBe(literalName);
    const expectedNames = [literalName, normalizedName].sort();
    const aliases = await db
      .select()
      .from(bottleAliases)
      .where(eq(bottleAliases.bottleId, result.bottle.id));
    expect(aliases).toHaveLength(expectedNames.length);
    expect(aliases).toEqual(
      expect.arrayContaining(
        expectedNames.map((name) =>
          expect.objectContaining({
            name,
            bottleId: result.bottle.id,
            assignmentSource: "canonical",
            ignored: false,
          }),
        ),
      ),
    );
    expect(queuedAliases.sort()).toEqual(expectedNames);
    expect(failedAliasName).not.toBeNull();
  });

  test("preserves classifier exact age through singleton creation and shared rematerialization", async ({
    fixtures,
  }) => {
    const mod = await fixtures.User({ mod: true });
    const brand = await fixtures.Entity({
      name: "Classifier Exact Age Brand",
      type: ["brand"],
    });
    const input = buildClassifierConcreteBottleInput({
      name: "Speyside 12-year-old",
      series: null,
      category: "single_malt",
      edition: null,
      statedAge: 12,
      caskStrength: null,
      singleCask: null,
      caskType: null,
      caskSize: null,
      caskFill: null,
      abv: null,
      vintageYear: null,
      releaseYear: null,
      brand: { id: brand.id, name: brand.name },
      distillers: [],
      bottler: null,
    });

    const created = await createConcreteBottle({
      context: contextFor(mod),
      creationSource: "bottle_classifier",
      input,
    });

    expect(created.group).toMatchObject({
      name: "Speyside 12-year-old",
      statedAge: null,
    });
    expect(created.bottle).toMatchObject({
      name: "Speyside 12-year-old",
      fullName: "Classifier Exact Age Brand Speyside 12-year-old",
      statedAge: 12,
    });

    const rematerialized = await updateConcreteBottle({
      bottleId: created.bottle.id,
      input: { shared: { statedAge: 15 } },
      context: contextFor(mod),
    });

    expect(rematerialized.group.statedAge).toBe(15);
    expect(rematerialized.bottle).toMatchObject({
      name: "Speyside 12-year-old",
      fullName: "Classifier Exact Age Brand Speyside 12-year-old",
      statedAge: 12,
    });
  });

  test("normalizes age wording without inferring structured age ownership", async ({
    defaults,
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Stable Age Brand" });
    const result = await createConcreteBottle({
      context: contextFor(defaults.user),
      input: {
        stable: { name: "Old Malt 12 years old", brand: brand.id },
        exact: {},
      },
    });

    expect(result.group).toMatchObject({
      name: "Old Malt 12-year-old",
      statedAge: null,
    });
    expect(result.bottle).toMatchObject({
      name: "Old Malt 12-year-old",
      statedAge: null,
    });
  });

  test("keeps stable release-like text out of omitted exact fields", async ({
    defaults,
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Stable Text Brand" });
    const result = await createConcreteBottle({
      context: contextFor(defaults.user),
      input: {
        stable: {
          name: "Distillers Edition 2011 Release Cask Strength",
          brand: brand.id,
        },
        exact: {
          vintageYear: 1998,
          singleCask: true,
        },
      },
    });

    expect(result.group).toMatchObject({
      name: "Distillers Edition 2011 Release Cask Strength",
      fullName:
        "Stable Text Brand Distillers Edition 2011 Release Cask Strength",
      statedAge: null,
    });
    expect(result.bottle).toMatchObject({
      vintageYear: 1998,
      singleCask: true,
      statedAge: null,
      releaseYear: null,
      caskStrength: null,
    });
  });

  test("materializes each exact cask identity field for an independent Bottle", async ({
    defaults,
    fixtures,
  }) => {
    const context = contextFor(defaults.user);
    const brand = await fixtures.Entity({ name: "Exact Cask Identity Brand" });
    const variants = [
      {
        exactCask: {
          caskType: "oloroso" as const,
          caskSize: "hogshead" as const,
          caskFill: "refill" as const,
        },
        nameSuffix: "Oloroso Cask - Hogshead - Refill",
      },
      {
        exactCask: {
          caskType: "bourbon" as const,
          caskSize: "butt" as const,
          caskFill: "refill" as const,
        },
        nameSuffix: "Bourbon Cask - Butt - Refill",
      },
      {
        exactCask: {
          caskType: "bourbon" as const,
          caskSize: "hogshead" as const,
          caskFill: "1st_fill" as const,
        },
        nameSuffix: "Bourbon Cask - Hogshead - 1st Fill",
      },
    ];

    for (const { exactCask, nameSuffix } of variants) {
      const result = await createConcreteBottle({
        context,
        input: {
          stable: { name: "Exact Cask Expression", brand: brand.id },
          exact: { edition: "Cask Selection", ...exactCask },
        },
      });
      expect(result.bottle).toMatchObject({
        ...exactCask,
        name: `Exact Cask Expression - Cask Selection - ${nameSuffix}`,
      });
      expect(result.group).toMatchObject({
        representativeBottleId: result.bottle.id,
        totalBottles: 1,
      });
    }
  });

  test.each([
    ["stable stated age", { stable: { statedAge: 12.5 } }],
    ["exact stated age", { exact: { statedAge: 12.5 } }],
    ["exact vintage year", { exact: { vintageYear: 2000.5 } }],
    ["exact release year", { exact: { releaseYear: 2020.5 } }],
  ])("rejects a fractional %s", (_label, overrides) => {
    const stableOverrides = "stable" in overrides ? overrides.stable : {};
    const exactOverrides = "exact" in overrides ? overrides.exact : {};
    expect(() =>
      ConcreteBottleCreateInputSchema.parse({
        stable: {
          name: "Integer Boundary",
          brand: 1,
          ...stableOverrides,
        },
        exact: { ...exactOverrides },
      }),
    ).toThrow();
  });

  test.each([
    ["numeric brand", { brand: 1.5 }],
    ["numeric bottler", { bottler: 0 }],
    ["numeric series", { series: -1 }],
    ["numeric distiller", { distillers: [2.5] }],
    ["nested brand", { brand: { id: 0, name: "Invalid Brand" } }],
    ["nested bottler", { bottler: { id: -1, name: "Invalid Bottler" } }],
    ["nested series", { series: { id: 2.5, name: "Invalid Series" } }],
    [
      "nested distiller",
      { distillers: [{ id: 0, name: "Invalid Distiller" }] },
    ],
  ])("rejects an invalid %s id", (_label, stableOverrides) => {
    expect(() =>
      ConcreteBottleCreateInputSchema.parse({
        stable: {
          name: "Entity ID Boundary",
          brand: 1,
          ...stableOverrides,
        },
        exact: {},
      }),
    ).toThrow();
  });

  test.each([
    {
      label: "source Bottle authority",
      input: {
        kind: "source_bottle",
        sourceBottleId: 1,
        exact: {},
      },
    },
    {
      label: "raw group authority",
      input: {
        groupId: 1,
        stable: { name: "Unauthorized Group Reuse", brand: 1 },
        exact: {},
      },
    },
  ])("rejects $label at the runtime boundary", ({ input }) => {
    expect(() => ConcreteBottleCreateInputSchema.parse(input)).toThrow();
  });

  test("blocks exact canonical aliases and duplicate SMWS codes", async ({
    defaults,
    fixtures,
  }) => {
    const context = contextFor(defaults.user);
    const brand = await fixtures.Entity({ name: "Duplicate Test Brand" });
    const input = {
      stable: { name: "Duplicate Expression", brand: brand.id },
      exact: { edition: "Batch 1" },
    };
    const first = await createConcreteBottle({ context, input });

    await expect(
      createConcreteBottle({ context, input }),
    ).rejects.toMatchObject({
      bottleId: first.bottle.id,
      collision: {
        kind: "canonical_name",
        attemptedCanonicalFullName: first.bottle.fullName,
      },
    });

    const smws = await fixtures.Entity({
      type: ["brand", "bottler"],
      name: "SMWS Concrete Guard Society",
      shortName: "SMWS",
    });
    const existing = await fixtures.Bottle({
      brandId: smws.id,
      bottlerId: smws.id,
      name: "35.331 Ultra hoggie",
      singleCask: true,
    });
    await expect(
      createConcreteBottle({
        context,
        input: {
          stable: {
            name: "35.331",
            brand: smws.id,
            bottler: smws.id,
          },
          exact: { singleCask: true },
        },
      }),
    ).rejects.toEqual(
      new BottleAlreadyExistsError(existing.id, {
        kind: "smws_code",
        attemptedCanonicalFullName: null,
        attemptedSmwsCode: "35.331",
      }),
    );
  });

  test("returns only Bottle-native identity when safely reusing a canonical duplicate", async ({
    defaults,
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Reuse Result Brand" });
    const actor = await getUserActor(defaults.user);
    const input = ConcreteBottleCreateInputSchema.parse({
      stable: { name: "Reuse Result Expression", brand: brand.id },
      exact: { edition: "Batch 1" },
    });
    const created = await createConcreteBottle({
      context: contextFor(defaults.user),
      input,
    });

    const reused = await db.transaction((tx) =>
      createOrReuseConcreteBottleInTransaction(tx, {
        creationSource: "bottle_classifier",
        createdByActorId: actor.id,
        input,
        context: contextFor(defaults.user),
      }),
    );

    expect(Object.keys(reused).sort()).toEqual(["bottle", "createResult"]);
    expect(reused).toMatchObject({
      bottle: { id: created.bottle.id },
      createResult: null,
    });
  });

  test("fails closed instead of reusing retired Bottle identities", async ({
    defaults,
    fixtures,
  }) => {
    const actor = await getUserActor(defaults.user);
    const context = contextFor(defaults.user);
    const replacement = await fixtures.Bottle();
    const groupReplacement = await fixtures.Bottle();
    const scenarios = [
      {
        reason: "bottle_retired",
        retire: async (
          bottle: Awaited<ReturnType<typeof createConcreteBottle>>,
        ) => {
          await db.insert(bottleTombstones).values({
            bottleId: bottle.bottle.id,
            newBottleId: replacement.id,
          });
        },
      },
      {
        reason: "group_retired",
        retire: async (
          bottle: Awaited<ReturnType<typeof createConcreteBottle>>,
        ) => {
          await db.insert(bottleGroupTombstones).values({
            groupId: bottle.group.id,
            newGroupId: groupReplacement.groupId!,
            createdByActorId: bottle.bottle.createdByActorId,
          });
        },
      },
    ] as const;

    for (const [index, scenario] of scenarios.entries()) {
      const brand = await fixtures.Entity({
        name: `Inactive Reuse Brand ${index}`,
      });
      const input = ConcreteBottleCreateInputSchema.parse({
        stable: {
          name: `Inactive Reuse Expression ${index}`,
          brand: brand.id,
        },
        exact: {},
      });
      const created = await createConcreteBottle({ context, input });
      await scenario.retire(created);

      await expect(
        db.transaction((tx) =>
          createOrReuseConcreteBottleInTransaction(tx, {
            creationSource: "bottle_classifier",
            createdByActorId: actor.id,
            input,
            context,
          }),
        ),
      ).rejects.toMatchObject({
        name: "ActiveBottleSelectionError",
        reason: scenario.reason,
        bottleId: created.bottle.id,
      });
    }
  });

  test("rolls back the group, Bottle, aliases, and audit on a literal alias collision", async ({
    defaults,
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Collision™ Test Brand" });
    const owner = await fixtures.Bottle({ name: "Existing Alias Owner" });
    const attemptedCanonicalFullName =
      "Collision™ Test Brand Blocked Expression";
    const normalizedAliasName = normalizeBottleAliasKey(
      attemptedCanonicalFullName,
    );
    await fixtures.BottleAlias({
      name: attemptedCanonicalFullName,
      bottleId: owner.id,
      assignmentSource: "human_approved",
    });
    const changesBefore = await db.select({ id: changes.id }).from(changes);
    await expect(
      createConcreteBottle({
        context: contextFor(defaults.user),
        input: {
          stable: { name: "Blocked Expression", brand: brand.id },
          exact: {},
        },
      }),
    ).rejects.toEqual(
      new BottleAlreadyExistsError(owner.id, {
        kind: "alias",
        attemptedCanonicalFullName,
      }),
    );

    expect(
      await db
        .select()
        .from(bottleGroups)
        .where(eq(bottleGroups.fullName, attemptedCanonicalFullName)),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(bottles)
        .where(eq(bottles.fullName, attemptedCanonicalFullName)),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(bottleAliases)
        .where(eq(bottleAliases.name, normalizedAliasName)),
    ).toEqual([]);
    const [persistedCollision] = await db
      .select()
      .from(bottleAliases)
      .where(eq(bottleAliases.name, attemptedCanonicalFullName));
    expect(persistedCollision).toMatchObject({
      bottleId: owner.id,
      assignmentSource: "human_approved",
    });
    expect(await db.select({ id: changes.id }).from(changes)).toEqual(
      changesBefore,
    );
  });

  test("keeps similar independent creates in distinct singleton groups", async ({
    defaults,
    fixtures,
  }) => {
    const context = contextFor(defaults.user);
    const brand = await fixtures.Entity({ name: "Singleton Test Brand" });
    const first = await createConcreteBottle({
      context,
      input: {
        stable: { name: "Shared Expression", brand: brand.id },
        exact: { edition: "Batch 1" },
      },
    });
    const second = await createConcreteBottle({
      context,
      input: {
        stable: { name: "Shared Expression", brand: brand.id },
        exact: { edition: "Batch 2" },
      },
    });

    expect(second.group.id).not.toBe(first.group.id);
    expect(first.group).toMatchObject({
      representativeBottleId: first.bottle.id,
      totalBottles: 1,
    });
    expect(second.group).toMatchObject({
      representativeBottleId: second.bottle.id,
      totalBottles: 1,
    });
    expect(first.bottle.groupId).toBe(first.group.id);
    expect(second.bottle.groupId).toBe(second.group.id);
  });

  test("rolls back the complete graph and can retry safely", async ({
    defaults,
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Rollback Test Brand" });
    const actor = await getUserActor(defaults.user);
    const input = {
      stable: { name: "Rollback Expression", brand: brand.id },
      exact: { edition: "Retryable" },
    };
    const parsedInput = ConcreteBottleCreateInputSchema.parse(input);
    const attempt: {
      result?: Awaited<ReturnType<typeof createConcreteBottleInTransaction>>;
    } = {};

    await expect(
      db.transaction(async (tx) => {
        attempt.result = await createConcreteBottleInTransaction(tx, {
          createdByActorId: actor.id,
          input: parsedInput,
          context: contextFor(defaults.user),
        });
        throw new Error("force rollback");
      }),
    ).rejects.toThrow("force rollback");

    const attempted = attempt.result;
    if (!attempted) {
      throw new Error("Expected the rolled-back creation attempt to finish.");
    }

    expect(
      await db
        .select()
        .from(bottleGroups)
        .where(eq(bottleGroups.id, attempted.group.id)),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(bottles)
        .where(eq(bottles.id, attempted.bottle.id)),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(bottleAliases)
        .where(eq(bottleAliases.name, attempted.newAliases[0])),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(changes)
        .where(
          and(
            eq(changes.objectType, "bottle"),
            eq(changes.objectId, attempted.bottle.id),
          ),
        ),
    ).toEqual([]);

    const retried = await createConcreteBottle({
      context: contextFor(defaults.user),
      input,
    });
    expect(retried.group.totalBottles).toBe(1);
    expect(retried.bottle.groupId).toBe(retried.group.id);
  });

  test("keeps a committed save when post-commit dispatch fails", async ({
    defaults,
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Post Commit Test Brand" });
    let visibleAtDispatch = false;
    vi.mocked(workerClient.pushUniqueJob).mockImplementationOnce(async () => {
      const [persisted] = await db
        .select({ id: bottles.id })
        .from(bottles)
        .where(eq(bottles.name, "Committed Before Queue"));
      visibleAtDispatch = Boolean(persisted);
      throw new Error("queue unavailable");
    });

    const result = await createConcreteBottle({
      context: contextFor(defaults.user),
      input: {
        stable: { name: "Committed Before Queue", brand: brand.id },
        exact: {},
      },
    });

    const [persisted] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, result.bottle.id));
    expect(visibleAtDispatch).toBe(true);
    expect(persisted.groupId).toBe(result.group.id);
  });
});
