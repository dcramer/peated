import { db } from "@peated/server/db";
import {
  bottleGroupDistillers,
  bottleGroups,
  bottleSeries,
  bottles,
  bottlesToDistillers,
  changes,
} from "@peated/server/db/schema";
import { repairBottleBrandDistilleryAssignments } from "@peated/server/lib/repairBottleBrandDistilleryAssignments";
import { and, eq, inArray } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

const pushUniqueJobMock = vi.hoisted(() => vi.fn());

vi.mock("@peated/server/worker/client", () => ({
  pushUniqueJob: pushUniqueJobMock,
}));

describe("repairBottleBrandDistilleryAssignments", () => {
  beforeEach(() => {
    pushUniqueJobMock.mockReset();
  });

  test("previews one shared BottleGroup repair without mutating members", async ({
    fixtures,
  }) => {
    const fromBrand = await fixtures.Entity({
      name: "Isle of Jura",
      type: ["brand", "distiller"],
    });
    const toBrand = await fixtures.Entity({ name: "Jura", type: ["brand"] });
    const sourceSeries = await fixtures.BottleSeries({
      brandId: fromBrand.id,
      name: "12-year-old",
    });
    const bottle = await fixtures.Bottle({
      brandId: fromBrand.id,
      name: "12-year-old Single Malt Scotch Whisky",
      seriesId: sourceSeries.id,
    });

    const result = await repairBottleBrandDistilleryAssignments({
      distilleryId: fromBrand.id,
      dryRun: true,
      fromBrand,
      toBrand,
    });

    expect(result.summary).toEqual({
      applied: 0,
      failed: 0,
      planned: 1,
      seriesCreated: 1,
      seriesReused: 0,
      total: 1,
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        bottleFullName: "Jura 12-year-old Single Malt Scotch Whisky",
        bottleId: bottle.id,
        distilleryAdded: true,
        groupId: bottle.groupId,
        message: expect.stringContaining(
          `BottleGroup ${bottle.groupId} fan-out`,
        ),
        seriesAction: "create_new",
        status: "planned",
      }),
    ]);
    expect(
      await db.query.bottles.findFirst({ where: eq(bottles.id, bottle.id) }),
    ).toMatchObject({ brandId: fromBrand.id, seriesId: sourceSeries.id });
    expect(pushUniqueJobMock).not.toHaveBeenCalled();
  });

  test("previews exact batch identity from BottleGroup authority despite member drift", async ({
    fixtures,
  }) => {
    const fromBrand = await fixtures.Entity({
      name: "Source Brand",
      type: ["brand", "distiller"],
    });
    const toBrand = await fixtures.Entity({ name: "Target Brand" });
    const sourceSeries = await fixtures.BottleSeries({
      brandId: fromBrand.id,
      name: "Annual Range",
    });
    const first = await fixtures.Bottle({
      brandId: fromBrand.id,
      distillerIds: [fromBrand.id],
      name: "Annual",
      seriesId: sourceSeries.id,
    });
    const second = await fixtures.BottleGroupMember({
      groupId: first.groupId as number,
      edition: "Batch 2",
    });
    await db
      .update(bottles)
      .set({ name: "Drifted Member", fullName: "Source Brand Drifted Member" })
      .where(eq(bottles.id, second.id));
    const memberIds = [first.id, second.id];
    const [
      membersBefore,
      groupBefore,
      distillersBefore,
      seriesBefore,
      auditsBefore,
    ] = await Promise.all([
      db.query.bottles.findMany({
        where: eq(bottles.groupId, first.groupId!),
        orderBy: (table, { asc }) => [asc(table.id)],
      }),
      db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, first.groupId!),
      }),
      db
        .select()
        .from(bottleGroupDistillers)
        .where(eq(bottleGroupDistillers.groupId, first.groupId!)),
      db.query.bottleSeries.findFirst({
        where: eq(bottleSeries.id, sourceSeries.id),
      }),
      db.select().from(changes).where(inArray(changes.objectId, memberIds)),
    ]);
    pushUniqueJobMock.mockReset();

    const result = await repairBottleBrandDistilleryAssignments({
      bottleIds: [second.id],
      dryRun: true,
      fromBrand,
      toBrand,
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        bottleId: second.id,
        bottleFullName: "Target Brand Annual - Batch 2",
        groupId: first.groupId,
        status: "planned",
      }),
    ]);
    expect(
      await db.query.bottles.findMany({
        where: eq(bottles.groupId, first.groupId!),
        orderBy: (table, { asc }) => [asc(table.id)],
      }),
    ).toEqual(membersBefore);
    expect(
      await db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, first.groupId!),
      }),
    ).toEqual(groupBefore);
    expect(
      await db
        .select()
        .from(bottleGroupDistillers)
        .where(eq(bottleGroupDistillers.groupId, first.groupId!)),
    ).toEqual(distillersBefore);
    expect(
      await db.query.bottleSeries.findFirst({
        where: eq(bottleSeries.id, sourceSeries.id),
      }),
    ).toEqual(seriesBefore);
    expect(
      await db
        .select()
        .from(changes)
        .where(inArray(changes.objectId, memberIds)),
    ).toEqual(auditsBefore);
    expect(pushUniqueJobMock).not.toHaveBeenCalled();
  });

  test("fans shared brand, distillery, name, and series changes to every concrete Bottle", async ({
    fixtures,
  }) => {
    const systemUser = await fixtures.User({ admin: true });
    const fromBrand = await fixtures.Entity({
      name: "Isle of Jura",
      type: ["brand", "distiller"],
    });
    const toBrand = await fixtures.Entity({ name: "Jura", type: ["brand"] });
    const sourceSeries = await fixtures.BottleSeries({
      brandId: fromBrand.id,
      name: "Annual",
    });
    const first = await fixtures.Bottle({
      brandId: fromBrand.id,
      name: "Annual",
      seriesId: sourceSeries.id,
    });
    const second = await fixtures.BottleGroupMember({
      groupId: first.groupId as number,
      edition: "Batch 2",
    });

    const result = await repairBottleBrandDistilleryAssignments({
      bottleIds: [first.id],
      distilleryId: fromBrand.id,
      dryRun: false,
      fromBrand,
      toBrand,
      user: systemUser,
    });

    expect(result.summary).toMatchObject({ applied: 1, failed: 0, total: 1 });
    expect(result.items[0]).toMatchObject({ groupId: first.groupId });
    const members = await db.query.bottles.findMany({
      where: eq(bottles.groupId, first.groupId!),
      orderBy: (table, { asc }) => [asc(table.id)],
    });
    expect(members).toHaveLength(2);
    expect(members.map(({ brandId }) => brandId)).toEqual([
      toBrand.id,
      toBrand.id,
    ]);
    expect(members.map(({ fullName }) => fullName)).toEqual([
      "Jura Annual",
      "Jura Annual - Batch 2",
    ]);
    expect(members.map(({ seriesId }) => seriesId)).toEqual([
      expect.any(Number),
      expect.any(Number),
    ]);
    expect(members[0]!.seriesId).toEqual(members[1]!.seriesId);
    expect(
      await db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, first.groupId!),
      }),
    ).toMatchObject({ brandId: toBrand.id, seriesId: members[0]!.seriesId });
    expect(
      await db
        .select()
        .from(bottleGroupDistillers)
        .where(eq(bottleGroupDistillers.groupId, first.groupId!)),
    ).toEqual([{ groupId: first.groupId, distillerId: fromBrand.id }]);
    expect(
      await db
        .select()
        .from(bottlesToDistillers)
        .where(eq(bottlesToDistillers.bottleId, second.id)),
    ).toEqual([{ bottleId: second.id, distillerId: fromBrand.id }]);

    const updateChanges = await db
      .select()
      .from(changes)
      .where(and(eq(changes.objectType, "bottle"), eq(changes.type, "update")));
    expect(updateChanges).toHaveLength(2);
    expect(updateChanges.map(({ data }) => data)).toEqual([
      expect.objectContaining({
        updateScope: "shared",
        groupId: first.groupId,
        creationSource: "repair_workflow",
      }),
      expect.objectContaining({
        updateScope: "shared",
        groupId: first.groupId,
        creationSource: "repair_workflow",
      }),
    ]);
    expect(pushUniqueJobMock).toHaveBeenCalledWith("OnBottleChange", {
      bottleId: first.id,
    });
    expect(pushUniqueJobMock).toHaveBeenCalledWith("OnBottleChange", {
      bottleId: second.id,
    });
  });

  test("reuses an existing target-brand series", async ({ fixtures }) => {
    const systemUser = await fixtures.User({ admin: true });
    const fromBrand = await fixtures.Entity({
      name: "Isle of Jura",
      type: ["brand", "distiller"],
    });
    const toBrand = await fixtures.Entity({ name: "Jura", type: ["brand"] });
    const sourceSeries = await fixtures.BottleSeries({
      brandId: fromBrand.id,
      name: "Elixir",
    });
    const targetSeries = await fixtures.BottleSeries({
      brandId: toBrand.id,
      name: "Elixir",
    });
    const bottle = await fixtures.Bottle({
      brandId: fromBrand.id,
      name: "Elixir",
      seriesId: sourceSeries.id,
      distillerIds: [fromBrand.id],
    });

    const result = await repairBottleBrandDistilleryAssignments({
      distilleryId: fromBrand.id,
      dryRun: false,
      fromBrand,
      toBrand,
      user: systemUser,
    });

    expect(result.summary).toMatchObject({
      applied: 1,
      failed: 0,
      seriesCreated: 0,
      seriesReused: 1,
    });
    expect(
      await db.query.bottles.findFirst({ where: eq(bottles.id, bottle.id) }),
    ).toMatchObject({
      brandId: toBrand.id,
      fullName: "Jura Elixir",
      seriesId: targetSeries.id,
    });
    expect(
      await db.query.bottleSeries.findFirst({
        where: eq(bottleSeries.id, targetSeries.id),
      }),
    ).toMatchObject({ numReleases: 1 });
  });

  test("uses the BottleGroup series when the selected member has drifted", async ({
    fixtures,
  }) => {
    const systemUser = await fixtures.User({ admin: true });
    const fromBrand = await fixtures.Entity({ name: "Source Brand" });
    const toBrand = await fixtures.Entity({ name: "Target Brand" });
    const authoritativeSeries = await fixtures.BottleSeries({
      brandId: fromBrand.id,
      name: "Authoritative Range",
    });
    const driftedSeries = await fixtures.BottleSeries({
      brandId: fromBrand.id,
      name: "Drifted Range",
    });
    const targetSeries = await fixtures.BottleSeries({
      brandId: toBrand.id,
      name: authoritativeSeries.name,
    });
    const bottle = await fixtures.Bottle({
      brandId: fromBrand.id,
      name: "Expression",
      seriesId: authoritativeSeries.id,
    });
    await db
      .update(bottles)
      .set({ seriesId: driftedSeries.id })
      .where(eq(bottles.id, bottle.id));

    const result = await repairBottleBrandDistilleryAssignments({
      bottleIds: [bottle.id],
      dryRun: false,
      fromBrand,
      toBrand,
      user: systemUser,
    });

    expect(result.summary).toMatchObject({
      applied: 1,
      failed: 0,
      seriesCreated: 0,
      seriesReused: 1,
    });
    expect(
      await db.query.bottleGroups.findFirst({
        where: eq(bottleGroups.id, bottle.groupId!),
      }),
    ).toMatchObject({ seriesId: targetSeries.id });
    expect(
      await db.query.bottles.findFirst({ where: eq(bottles.id, bottle.id) }),
    ).toMatchObject({ seriesId: targetSeries.id });
  });

  test("refuses to mutate an ungrouped pre-migration Bottle", async ({
    fixtures,
  }) => {
    const systemUser = await fixtures.User({ admin: true });
    const fromBrand = await fixtures.Entity({ name: "Legacy Brand" });
    const toBrand = await fixtures.Entity({ name: "Target Brand" });
    const bottle = await fixtures.LegacyBottle({ brandId: fromBrand.id });

    const result = await repairBottleBrandDistilleryAssignments({
      dryRun: false,
      fromBrand,
      toBrand,
      user: systemUser,
    });

    expect(result.summary).toMatchObject({ failed: 1, applied: 0 });
    expect(result.items[0]?.message).toContain("BottleGroup migration");
    expect(
      await db.query.bottles.findFirst({ where: eq(bottles.id, bottle.id) }),
    ).toMatchObject({ brandId: fromBrand.id });
  });
});
