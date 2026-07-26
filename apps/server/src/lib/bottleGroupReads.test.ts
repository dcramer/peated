import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleGroups,
  bottles,
  catalogTargets,
} from "@peated/server/db/schema";
import {
  CatalogTargetIntegrityMismatchError,
  CatalogTargetNotFoundError,
} from "@peated/server/lib/catalogTargets";
import { and, eq, isNull } from "drizzle-orm";
import {
  listBottleGroupAliases,
  listBottleGroupBottles,
  loadBottleGroup,
} from "./bottleGroupReads";

const readContext = {
  actor: null,
  permissions: { canReadCatalogIdentity: true },
} as const;

async function getGenericTargetId(groupId: number): Promise<number> {
  const target = await db.query.catalogTargets.findFirst({
    where: and(
      eq(catalogTargets.groupId, groupId),
      isNull(catalogTargets.bottleId),
    ),
  });
  if (!target) throw new Error("Missing generic target fixture");
  return target.id;
}

async function getExactTargetId(bottleId: number): Promise<number> {
  const target = await db.query.catalogTargets.findFirst({
    where: eq(catalogTargets.bottleId, bottleId),
  });
  if (!target) throw new Error("Missing exact target fixture");
  return target.id;
}

async function createBottleInGroup(
  source: {
    groupId: number | null;
    brandId: number;
    createdByActorId: number;
  },
  data: { fullName: string; name: string; releaseYear?: number },
) {
  if (source.groupId === null) throw new Error("Missing source group fixture");
  const groupId = source.groupId;
  return await db.transaction(async (tx) => {
    const [bottle] = await tx
      .insert(bottles)
      .values({
        ...data,
        groupId,
        brandId: source.brandId,
        createdByActorId: source.createdByActorId,
      })
      .returning();
    if (!bottle) throw new Error("Unable to create related Bottle fixture");

    const [target] = await tx
      .insert(catalogTargets)
      .values({ groupId, bottleId: bottle.id })
      .returning();
    if (!target) throw new Error("Unable to create exact target fixture");

    await tx.insert(bottleAliases).values({
      bottleId: bottle.id,
      targetId: target.id,
      name: bottle.fullName,
      assignmentSource: "canonical",
      assignedByActorId: source.createdByActorId,
    });
    await tx
      .update(bottleGroups)
      .set({ totalBottles: 2 })
      .where(eq(bottleGroups.id, groupId));

    return { bottle, target };
  });
}

describe("BottleGroup reads", () => {
  test("lists independently complete exact Bottle targets and direct generic aliases", async ({
    fixtures,
  }) => {
    const source = await fixtures.Bottle({ releaseYear: 2020 });
    const related = await createBottleInGroup(source, {
      name: "Batch Two",
      fullName: "Independent Batch Two",
      releaseYear: 2024,
    });
    const genericTargetId = await getGenericTargetId(source.groupId as number);
    await db.insert(bottleAliases).values([
      {
        bottleId: null,
        releaseId: null,
        targetId: genericTargetId,
        name: "Expression stable alias",
        assignmentSource: "source_approved",
        assignedByActorId: source.createdByActorId,
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      },
      {
        bottleId: null,
        releaseId: null,
        targetId: genericTargetId,
        name: "Ignored stable alias",
        ignored: true,
        assignmentSource: "source_approved",
        assignedByActorId: source.createdByActorId,
      },
    ]);

    const members = await listBottleGroupBottles(
      source.groupId as number,
      { query: "Independent Batch", cursor: 1, limit: 25, sort: "name" },
      readContext,
    );
    expect(members.results).toHaveLength(1);
    expect(members.results[0]).toMatchObject({
      kind: "bottle",
      targetId: related.target.id,
      bottle: {
        id: related.bottle.id,
        fullName: "Independent Batch Two",
        releaseYear: 2024,
      },
      group: { id: source.groupId },
    });

    const aliases = await listBottleGroupAliases(
      source.groupId as number,
      { cursor: 1, limit: 25 },
      readContext,
    );
    expect(aliases).toEqual({
      results: [
        {
          name: "Expression stable alias",
          assignmentSource: "source_approved",
          createdAt: "2026-01-02T00:00:00.000Z",
        },
      ],
      rel: { nextCursor: null, prevCursor: null },
    });
  });

  test("distinguishes an absent group from a malformed group without a generic target", async ({
    fixtures,
  }) => {
    await expect(loadBottleGroup(999_999, readContext)).rejects.toBeInstanceOf(
      CatalogTargetNotFoundError,
    );

    const bottle = await fixtures.Bottle();
    await db
      .delete(catalogTargets)
      .where(
        and(
          eq(catalogTargets.groupId, bottle.groupId as number),
          isNull(catalogTargets.bottleId),
        ),
      );

    await expect(
      loadBottleGroup(bottle.groupId as number, readContext),
    ).rejects.toBeInstanceOf(CatalogTargetIntegrityMismatchError);
  });

  test("fails a related Bottle list when an active member has no exact target", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const targetId = await getExactTargetId(bottle.id);
    await db.delete(bottleAliases).where(eq(bottleAliases.targetId, targetId));
    await db.delete(catalogTargets).where(eq(catalogTargets.id, targetId));

    await expect(
      listBottleGroupBottles(
        bottle.groupId as number,
        { query: "", cursor: 1, limit: 25, sort: "name" },
        readContext,
      ),
    ).rejects.toBeInstanceOf(CatalogTargetIntegrityMismatchError);
  });
});
