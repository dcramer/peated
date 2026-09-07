import { db } from "@peated/server/db";
import { changes } from "@peated/server/db/schema";
import { and, eq } from "drizzle-orm";
import verifyEntityCreation from "./verifyEntityCreation";

describe("verifyEntityCreation", () => {
  test("does not record changes for flagged automated entities", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({
      name: "Bourbon Whiskey",
      kind: "brand",
    });

    await verifyEntityCreation({
      entityId: entity.id,
      creationSource: "price_match_automation",
    });

    expect(
      await db
        .select()
        .from(changes)
        .where(
          and(
            eq(changes.objectType, "entity"),
            eq(changes.objectId, entity.id),
            eq(changes.type, "update"),
          ),
        ),
    ).toEqual([]);
  });

  test("does not record changes for passed entity verification", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({
      name: "Specific Brand",
      kind: "brand",
    });

    await verifyEntityCreation({
      entityId: entity.id,
      creationSource: "manual_entry",
    });

    expect(
      await db
        .select()
        .from(changes)
        .where(
          and(
            eq(changes.objectType, "entity"),
            eq(changes.objectId, entity.id),
            eq(changes.type, "update"),
          ),
        ),
    ).toEqual([]);
  });

  test("does not record changes for skipped trusted creation flows", async ({
    fixtures,
  }) => {
    const entity = await fixtures.Entity({
      name: "Trusted Brand",
      kind: "brand",
    });

    await verifyEntityCreation({
      entityId: entity.id,
      creationSource: "repair_workflow",
    });

    expect(
      await db
        .select()
        .from(changes)
        .where(
          and(
            eq(changes.objectType, "entity"),
            eq(changes.objectId, entity.id),
            eq(changes.type, "update"),
          ),
        ),
    ).toEqual([]);
  });

  test("skips stale verification for a deleted Entity", async () => {
    await expect(
      verifyEntityCreation({
        entityId: 2_147_483_647,
        creationSource: "repair_workflow",
      }),
    ).resolves.toBeUndefined();
  });
});
