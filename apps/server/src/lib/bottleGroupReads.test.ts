import { db } from "@peated/server/db";
import { bottleAliases, catalogTargets } from "@peated/server/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import {
  BottleGroupNotFoundError,
  listBottleGroupBottles,
  loadBottleGroup,
} from "./bottleGroupReads";

async function getExactTargetId(bottleId: number): Promise<number> {
  const target = await db.query.catalogTargets.findFirst({
    where: eq(catalogTargets.bottleId, bottleId),
  });
  if (!target) throw new Error("Missing exact target fixture");
  return target.id;
}

describe("BottleGroup reads", () => {
  test("lists independently complete Bottles by their direct aliases", async ({
    fixtures,
  }) => {
    const source = await fixtures.Bottle({
      name: "Independent Batch",
      releaseYear: 2020,
    });
    const related = await fixtures.BottleGroupMember({
      groupId: source.groupId as number,
      edition: "Batch Two",
      releaseYear: 2024,
    });
    const relatedTargetId = await getExactTargetId(related.id);
    await db.insert(bottleAliases).values({
      bottleId: related.id,
      releaseId: null,
      targetId: relatedTargetId,
      name: "Alternate exact member",
      assignmentSource: "source_approved",
      assignedByActorId: source.createdByActorId,
    });

    const members = await listBottleGroupBottles(source.groupId as number, {
      query: "Alternate exact",
      cursor: 1,
      limit: 25,
      sort: "name",
    });
    expect(members.results).toHaveLength(1);
    expect(members.results[0]).toMatchObject({
      id: related.id,
      releaseYear: 2024,
      group: { id: source.groupId },
    });
    expect(members.results[0]).not.toHaveProperty("targetId");
    expect(members.results[0]).not.toHaveProperty("kind");
  });

  test("loads direct group data without requiring a generic target", async ({
    fixtures,
  }) => {
    await expect(loadBottleGroup(999_999)).rejects.toBeInstanceOf(
      BottleGroupNotFoundError,
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
      loadBottleGroup(bottle.groupId as number),
    ).resolves.toMatchObject({
      id: bottle.groupId,
      representativeBottleId: bottle.id,
    });
  });

  test("lists an active member without requiring an exact target", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const targetId = await getExactTargetId(bottle.id);
    await db.delete(bottleAliases).where(eq(bottleAliases.targetId, targetId));
    await db.delete(catalogTargets).where(eq(catalogTargets.id, targetId));

    await expect(
      listBottleGroupBottles(bottle.groupId as number, {
        query: "",
        cursor: 1,
        limit: 25,
        sort: "name",
      }),
    ).resolves.toMatchObject({
      results: [{ id: bottle.id, group: { id: bottle.groupId } }],
    });
  });
});
