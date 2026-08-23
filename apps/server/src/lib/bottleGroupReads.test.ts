import { db } from "@peated/server/db";
import { bottleAliases } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import {
  BottleGroupNotFoundError,
  listBottleGroupBottles,
  loadBottleGroup,
} from "./bottleGroupReads";

function requireGroupId(groupId: number | null): number {
  if (groupId === null) throw new Error("Missing BottleGroup fixture");
  return groupId;
}

describe("BottleGroup reads", () => {
  test("lists independently complete Bottles by their direct aliases", async ({
    fixtures,
  }) => {
    const source = await fixtures.Bottle({
      name: "Independent Batch",
      releaseYear: 2020,
    });
    const groupId = requireGroupId(source.groupId);
    const related = await fixtures.BottleGroupMember({
      groupId,
      edition: "Batch Two",
      releaseYear: 2024,
    });
    await db.insert(bottleAliases).values({
      bottleId: related.id,
      name: "Alternate exact member",
      assignmentSource: "source_approved",
      assignedByActorId: source.createdByActorId,
    });

    const members = await listBottleGroupBottles(groupId, {
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
    expect(members.results[0]).not.toHaveProperty("kind");
  });

  test("loads direct group data", async ({ fixtures }) => {
    await expect(loadBottleGroup(999_999)).rejects.toBeInstanceOf(
      BottleGroupNotFoundError,
    );

    const bottle = await fixtures.Bottle();
    const groupId = requireGroupId(bottle.groupId);

    await expect(loadBottleGroup(groupId)).resolves.toMatchObject({
      id: bottle.groupId,
      representativeBottleId: bottle.id,
    });
  });

  test("lists an active member without requiring an alias", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const groupId = requireGroupId(bottle.groupId);
    await db.delete(bottleAliases).where(eq(bottleAliases.bottleId, bottle.id));

    await expect(
      listBottleGroupBottles(groupId, {
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
