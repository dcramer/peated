import { db } from "@peated/server/db";
import { getPostgresConnectionConfig } from "@peated/server/db/connection";
import {
  bottleAliases,
  bottleGroupDistillers,
  bottleGroupTombstones,
  bottleGroups,
  bottleTombstones,
  bottles,
  bottlesToDistillers,
  catalogTargets,
  changes,
} from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import { BottleAlreadyExistsError } from "@peated/server/lib/createBottle";
import {
  ConcreteBottleCreateInputSchema,
  TrustedSourceBottleError,
  createConcreteBottle,
  createConcreteBottleInTransaction,
} from "@peated/server/lib/createConcreteBottle";
import waitError from "@peated/server/lib/test/waitError";
import * as workerClient from "@peated/server/worker/client";
import { and, eq, isNull } from "drizzle-orm";
import pg from "pg";
import { vi } from "vitest";

const { Client } = pg;
type NodePgClient = InstanceType<typeof Client>;

async function waitForSessionBlockedBy(
  observer: NodePgClient,
  blockerPid: number,
): Promise<number> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const result = await observer.query<{ pid: number }>(
      `SELECT pid
       FROM pg_stat_activity
       WHERE $1 = ANY(pg_blocking_pids(pid))
       ORDER BY pid
       LIMIT 1`,
      [blockerPid],
    );
    const blockedPid = result.rows[0]?.pid;
    if (blockedPid) return blockedPid;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for trusted Bottle graph lock.");
}

async function expectNowaitLockFailure(
  observer: NodePgClient,
  query: string,
  values: unknown[],
) {
  await observer.query("BEGIN");
  try {
    await expect(observer.query(query, values)).rejects.toMatchObject({
      code: "55P03",
    });
  } finally {
    await observer.query("ROLLBACK");
  }
}

function contextFor(user: Parameters<typeof getUserActor>[0]) {
  return { user } as Parameters<typeof createConcreteBottle>[0]["context"];
}

describe("concrete Bottle creation", () => {
  test("creates an independent singleton graph with stable and exact field ownership", async ({
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
        kind: "independent",
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
    expect(result.genericTarget).toMatchObject({
      groupId: result.group.id,
      bottleId: null,
    });
    expect(result.exactTarget).toMatchObject({
      groupId: result.group.id,
      bottleId: result.bottle.id,
    });
    expect(result.likelyGroups).toEqual([]);

    const [alias] = await db
      .select()
      .from(bottleAliases)
      .where(eq(bottleAliases.bottleId, result.bottle.id));
    expect(alias).toMatchObject({
      targetId: result.exactTarget.id,
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

  test("reuses only a trusted source Bottle group and preserves its representative", async ({
    defaults,
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Trusted Reuse Brand" });
    const first = await createConcreteBottle({
      context: contextFor(defaults.user),
      input: {
        kind: "independent",
        stable: {
          name: "Annual Release",
          statedAge: 18,
          brand: brand.id,
        },
        exact: { edition: "2025 Release", releaseYear: 2025 },
      },
    });
    const second = await createConcreteBottle({
      context: contextFor(defaults.user),
      input: {
        kind: "source_bottle",
        sourceBottleId: first.bottle.id,
        exact: {
          edition: "2026 Release",
          releaseYear: 2026,
          statedAge: 19,
        },
      },
    });

    expect(second.bottle).toMatchObject({
      groupId: first.group.id,
      brandId: brand.id,
      edition: "2026 Release",
      releaseYear: 2026,
      statedAge: 19,
    });
    expect(second.group).toMatchObject({
      id: first.group.id,
      statedAge: 18,
      totalBottles: 2,
      representativeBottleId: first.bottle.id,
    });
    expect(second.exactTarget).toMatchObject({
      groupId: first.group.id,
      bottleId: second.bottle.id,
    });
    expect(second.genericTarget.id).toBe(first.genericTarget.id);
    expect(second.likelyGroups).toEqual([]);

    expect(
      await db
        .select()
        .from(bottleGroups)
        .where(eq(bottleGroups.id, first.group.id)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(catalogTargets)
        .where(
          and(
            eq(catalogTargets.groupId, first.group.id),
            isNull(catalogTargets.bottleId),
          ),
        ),
    ).toHaveLength(1);
  });

  test("revalidates trusted membership after waiting for the discovered group", async ({
    defaults,
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Membership Recheck Brand" });
    const source = await createConcreteBottle({
      context: contextFor(defaults.user),
      input: {
        kind: "independent",
        stable: { name: "Membership Recheck Source", brand: brand.id },
        exact: { edition: "Original" },
      },
    });
    const destination = await createConcreteBottle({
      context: contextFor(defaults.user),
      input: {
        kind: "independent",
        stable: { name: "Membership Recheck Destination", brand: brand.id },
        exact: { edition: "Original" },
      },
    });
    const mover = new Client(getPostgresConnectionConfig());
    const observer = new Client(getPostgresConnectionConfig());
    let creation: ReturnType<typeof createConcreteBottle> | null = null;
    let moverCommitted = false;

    await mover.connect();
    await observer.connect();
    try {
      await mover.query("BEGIN");
      const moverPid = (
        await mover.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
      ).rows[0]?.pid;
      if (!moverPid) throw new Error("Unable to load membership mover pid.");

      await mover.query(
        `SELECT id
         FROM bottle_group
         WHERE id = ANY($1::bigint[])
         ORDER BY id
         FOR UPDATE`,
        [[source.group.id, destination.group.id]],
      );

      creation = createConcreteBottle({
        context: contextFor(defaults.user),
        input: {
          kind: "source_bottle",
          sourceBottleId: source.bottle.id,
          exact: { edition: "Must Revalidate" },
        },
      });
      void creation.catch(() => undefined);
      await waitForSessionBlockedBy(observer, moverPid);

      await observer.query("BEGIN");
      await expect(
        observer.query(
          "SELECT id FROM bottle WHERE id = $1 FOR UPDATE NOWAIT",
          [source.bottle.id],
        ),
      ).resolves.toBeDefined();
      await observer.query("ROLLBACK");

      await mover.query("SELECT id FROM bottle WHERE id = $1 FOR UPDATE", [
        source.bottle.id,
      ]);
      await mover.query(
        `SELECT id
         FROM catalog_target
         WHERE bottle_group_id = $1
           AND (bottle_id IS NULL OR bottle_id = $2)
         ORDER BY id
         FOR UPDATE`,
        [source.group.id, source.bottle.id],
      );
      await mover.query(
        `UPDATE bottle_group
         SET representative_bottle_id = NULL,
             total_bottles = total_bottles - 1
         WHERE id = $1`,
        [source.group.id],
      );
      await mover.query("UPDATE bottle SET group_id = $2 WHERE id = $1", [
        source.bottle.id,
        destination.group.id,
      ]);
      await mover.query(
        `UPDATE bottle_group
         SET total_bottles = total_bottles + 1
         WHERE id = $1`,
        [destination.group.id],
      );
      await mover.query("COMMIT");
      moverCommitted = true;

      const error = await waitError(creation, TrustedSourceBottleError);
      expect(error).toMatchObject({
        code: "invalid_catalog_graph",
        sourceBottleId: source.bottle.id,
      });
    } finally {
      if (!moverCommitted) {
        await mover.query("ROLLBACK").catch(() => undefined);
      }
      if (creation) await creation.catch(() => undefined);
      await mover.end();
      await observer.end();
    }

    expect(
      await db
        .select({ id: bottles.id })
        .from(bottles)
        .where(eq(bottles.edition, "Must Revalidate")),
    ).toEqual([]);
  });

  test("locks trusted Group and Bottle before required CatalogTargets", async ({
    defaults,
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Hierarchy Lock Brand" });
    const source = await createConcreteBottle({
      context: contextFor(defaults.user),
      input: {
        kind: "independent",
        stable: { name: "Hierarchy Lock Source", brand: brand.id },
        exact: { edition: "Original" },
      },
    });
    const targetBlocker = new Client(getPostgresConnectionConfig());
    const observer = new Client(getPostgresConnectionConfig());
    let creation: ReturnType<typeof createConcreteBottle> | null = null;
    let blockerCommitted = false;

    expect(source.genericTarget.id).toBeLessThan(source.exactTarget.id);
    await targetBlocker.connect();
    await observer.connect();
    try {
      await targetBlocker.query("BEGIN");
      const blockerPid = (
        await targetBlocker.query<{ pid: number }>(
          "SELECT pg_backend_pid() AS pid",
        )
      ).rows[0]?.pid;
      if (!blockerPid) throw new Error("Unable to load target blocker pid.");
      await targetBlocker.query(
        "SELECT id FROM catalog_target WHERE id = $1 FOR UPDATE",
        [source.exactTarget.id],
      );

      creation = createConcreteBottle({
        context: contextFor(defaults.user),
        input: {
          kind: "source_bottle",
          sourceBottleId: source.bottle.id,
          exact: { edition: "Hierarchy Child" },
        },
      });
      void creation.catch(() => undefined);
      await waitForSessionBlockedBy(observer, blockerPid);

      await expectNowaitLockFailure(
        observer,
        "SELECT id FROM bottle_group WHERE id = $1 FOR UPDATE NOWAIT",
        [source.group.id],
      );
      await expectNowaitLockFailure(
        observer,
        "SELECT id FROM bottle WHERE id = $1 FOR UPDATE NOWAIT",
        [source.bottle.id],
      );
      await expectNowaitLockFailure(
        observer,
        "SELECT id FROM catalog_target WHERE id = $1 FOR UPDATE NOWAIT",
        [source.genericTarget.id],
      );

      await targetBlocker.query("COMMIT");
      blockerCommitted = true;
      await expect(creation).resolves.toMatchObject({
        group: { id: source.group.id },
        bottle: { edition: "Hierarchy Child" },
      });
    } finally {
      if (!blockerCommitted) {
        await targetBlocker.query("ROLLBACK").catch(() => undefined);
      }
      if (creation) await creation.catch(() => undefined);
      await targetBlocker.end();
      await observer.end();
    }
  });

  test("keeps an age stated by the stable name on the group", async ({
    defaults,
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Stable Age Brand" });
    const result = await createConcreteBottle({
      context: contextFor(defaults.user),
      input: {
        kind: "independent",
        stable: { name: "Old Malt 12 years old", brand: brand.id },
        exact: {},
      },
    });

    expect(result.group).toMatchObject({
      name: "Old Malt 12-year-old",
      statedAge: 12,
    });
    expect(result.bottle).toMatchObject({
      name: "Old Malt 12-year-old",
      statedAge: 12,
    });
  });

  test("uses curated group names verbatim for trusted reuse", async ({
    defaults,
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Original Group Brand" });
    const source = await createConcreteBottle({
      context: contextFor(defaults.user),
      input: {
        kind: "independent",
        stable: { name: "Original Expression", brand: brand.id },
        exact: { edition: "First Release" },
      },
    });
    const [curatedGroup] = await db
      .update(bottleGroups)
      .set({
        name: "Curated Expression 12 years old",
        fullName: "Editorial Group Heading 12 years old",
        statedAge: null,
      })
      .where(eq(bottleGroups.id, source.group.id))
      .returning();

    const anotherRelease = await createConcreteBottle({
      context: contextFor(defaults.user),
      input: {
        kind: "source_bottle",
        sourceBottleId: source.bottle.id,
        exact: { edition: "Second Release" },
      },
    });

    expect(anotherRelease.bottle).toMatchObject({
      name: "Curated Expression 12 years old - Second Release",
      fullName: "Editorial Group Heading 12 years old - Second Release",
      statedAge: null,
    });
    expect(anotherRelease.group).toMatchObject({
      id: curatedGroup.id,
      name: curatedGroup.name,
      fullName: curatedGroup.fullName,
      statedAge: null,
      representativeBottleId: source.bottle.id,
      totalBottles: 2,
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
        kind: "independent",
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

  test("rejects missing, retired, and incomplete trusted source graphs", async ({
    defaults,
    fixtures,
  }) => {
    const context = contextFor(defaults.user);
    await expect(
      createConcreteBottle({
        context,
        input: {
          kind: "source_bottle",
          sourceBottleId: 999_999,
          exact: { edition: "Missing" },
        },
      }),
    ).rejects.toMatchObject({ code: "not_found" });

    const retired = await fixtures.Bottle();
    const replacement = await fixtures.Bottle();
    await db.insert(bottleTombstones).values({
      bottleId: retired.id,
      newBottleId: replacement.id,
    });
    await expect(
      createConcreteBottle({
        context,
        input: {
          kind: "source_bottle",
          sourceBottleId: retired.id,
          exact: { edition: "Retired" },
        },
      }),
    ).rejects.toMatchObject({
      code: "retired",
      sourceBottleId: retired.id,
    });

    const legacy = await fixtures.LegacyBottle();
    await expect(
      createConcreteBottle({
        context,
        input: {
          kind: "source_bottle",
          sourceBottleId: legacy.id,
          exact: { edition: "Legacy" },
        },
      }),
    ).rejects.toBeInstanceOf(TrustedSourceBottleError);
  });

  test("rejects a source whose group is retired without writing", async ({
    defaults,
    fixtures,
  }) => {
    const context = contextFor(defaults.user);
    const brand = await fixtures.Entity({ name: "Retired Group Brand" });
    const source = await createConcreteBottle({
      context,
      input: {
        kind: "independent",
        stable: { name: "Retired Group Source", brand: brand.id },
        exact: { edition: "Original" },
      },
    });
    const replacement = await createConcreteBottle({
      context,
      input: {
        kind: "independent",
        stable: { name: "Replacement Group", brand: brand.id },
        exact: { edition: "Original" },
      },
    });
    const actor = await getUserActor(defaults.user);
    await db.insert(bottleGroupTombstones).values({
      groupId: source.group.id,
      newGroupId: replacement.group.id,
      createdByActorId: actor.id,
    });

    const error = await waitError(
      createConcreteBottle({
        context,
        input: {
          kind: "source_bottle",
          sourceBottleId: source.bottle.id,
          exact: { edition: "Must Not Persist" },
        },
      }),
      TrustedSourceBottleError,
    );
    expect(error).toBeInstanceOf(TrustedSourceBottleError);
    expect(error).toMatchObject({
      code: "retired",
      sourceBottleId: source.bottle.id,
    });

    expect(
      await db
        .select({ id: bottles.id })
        .from(bottles)
        .where(eq(bottles.groupId, source.group.id)),
    ).toEqual([{ id: source.bottle.id }]);
    expect(
      await db
        .select({ totalBottles: bottleGroups.totalBottles })
        .from(bottleGroups)
        .where(eq(bottleGroups.id, source.group.id)),
    ).toEqual([{ totalBottles: 1 }]);
  });

  for (const missingTarget of ["generic", "exact"] as const) {
    test(`rejects a trusted source with a missing ${missingTarget} target without writing`, async ({
      defaults,
      fixtures,
    }) => {
      const context = contextFor(defaults.user);
      const brand = await fixtures.Entity({
        name: `Missing ${missingTarget} Target Brand`,
      });
      const source = await createConcreteBottle({
        context,
        input: {
          kind: "independent",
          stable: {
            name: `Missing ${missingTarget} Target Source`,
            brand: brand.id,
          },
          exact: { edition: "Original" },
        },
      });
      const missingTargetId =
        missingTarget === "generic"
          ? source.genericTarget.id
          : source.exactTarget.id;

      if (missingTarget === "exact") {
        await db
          .update(bottleAliases)
          .set({ targetId: null })
          .where(eq(bottleAliases.targetId, missingTargetId));
      }
      await db
        .delete(catalogTargets)
        .where(eq(catalogTargets.id, missingTargetId));

      const error = await waitError(
        createConcreteBottle({
          context,
          input: {
            kind: "source_bottle",
            sourceBottleId: source.bottle.id,
            exact: { edition: "Must Not Persist" },
          },
        }),
        TrustedSourceBottleError,
      );
      expect(error).toBeInstanceOf(TrustedSourceBottleError);
      expect(error).toMatchObject({
        code: "invalid_catalog_graph",
        sourceBottleId: source.bottle.id,
      });

      expect(
        await db
          .select({ id: bottles.id })
          .from(bottles)
          .where(eq(bottles.groupId, source.group.id)),
      ).toEqual([{ id: source.bottle.id }]);
      expect(
        await db
          .select({ totalBottles: bottleGroups.totalBottles })
          .from(bottleGroups)
          .where(eq(bottleGroups.id, source.group.id)),
      ).toEqual([{ totalBottles: 1 }]);
    });
  }

  test("accepts trusted-source variants for each exact cask identity field", async ({
    defaults,
    fixtures,
  }) => {
    const context = contextFor(defaults.user);
    const brand = await fixtures.Entity({ name: "Exact Cask Identity Brand" });
    const source = await createConcreteBottle({
      context,
      input: {
        kind: "independent",
        stable: { name: "Exact Cask Expression", brand: brand.id },
        exact: {
          edition: "Cask Selection",
          caskType: "bourbon",
          caskSize: "hogshead",
          caskFill: "refill",
        },
      },
    });
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
          kind: "source_bottle",
          sourceBottleId: source.bottle.id,
          exact: { edition: "Cask Selection", ...exactCask },
        },
      });
      expect(result.bottle).toMatchObject({
        ...exactCask,
        name: `Exact Cask Expression - Cask Selection - ${nameSuffix}`,
      });
    }

    await expect(
      createConcreteBottle({
        context,
        input: {
          kind: "source_bottle",
          sourceBottleId: source.bottle.id,
          exact: {
            edition: "Cask Selection",
            caskType: "bourbon",
            caskSize: "hogshead",
            caskFill: "refill",
          },
        },
      }),
    ).rejects.toMatchObject({ bottleId: source.bottle.id });
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
        kind: "independent",
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
        kind: "independent",
        stable: {
          name: "Entity ID Boundary",
          brand: 1,
          ...stableOverrides,
        },
        exact: {},
      }),
    ).toThrow();
  });

  test("does not expose a raw group id as creation authority", async ({
    defaults,
    fixtures,
  }) => {
    const brand = await fixtures.Entity();
    const existing = await fixtures.Bottle({ brandId: brand.id });
    const invalidInput = {
      kind: "independent",
      groupId: existing.groupId,
      stable: { name: "Unauthorized Group Reuse", brand: brand.id },
      exact: {},
    };

    expect(() => ConcreteBottleCreateInputSchema.parse(invalidInput)).toThrow();
    await expect(
      createConcreteBottle({
        context: contextFor(defaults.user),
        input: invalidInput as never,
      }),
    ).rejects.toThrow();

    const created = await db
      .select()
      .from(bottles)
      .where(eq(bottles.name, "Unauthorized Group Reuse"));
    expect(created).toEqual([]);
  });

  test("blocks exact canonical aliases and duplicate SMWS codes", async ({
    defaults,
    fixtures,
  }) => {
    const context = contextFor(defaults.user);
    const brand = await fixtures.Entity({ name: "Duplicate Test Brand" });
    const input = {
      kind: "independent" as const,
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
          kind: "independent",
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
      }),
    );
  });

  test("returns deterministic likely groups without using them for grouping", async ({
    defaults,
    fixtures,
  }) => {
    const context = contextFor(defaults.user);
    const brand = await fixtures.Entity({ name: "Suggestion Test Brand" });
    const first = await createConcreteBottle({
      context,
      input: {
        kind: "independent",
        stable: { name: "Shared Expression", brand: brand.id },
        exact: { edition: "Batch 1" },
      },
    });
    const second = await createConcreteBottle({
      context,
      input: {
        kind: "independent",
        stable: { name: "Shared Expression", brand: brand.id },
        exact: { edition: "Batch 2" },
      },
    });

    expect(second.likelyGroups).toEqual([
      {
        id: first.group.id,
        name: first.group.name,
        fullName: first.group.fullName,
      },
    ]);
    expect(second.group.id).not.toBe(first.group.id);
    expect(second.group.totalBottles).toBe(1);
  });

  test("rolls back the complete graph and can retry safely", async ({
    defaults,
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Rollback Test Brand" });
    const actor = await getUserActor(defaults.user);
    const input = {
      kind: "independent" as const,
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
        .from(catalogTargets)
        .where(eq(catalogTargets.groupId, attempted.group.id)),
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
        kind: "independent",
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
