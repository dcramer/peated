import { db } from "@peated/server/db";
import { bottleAliases, catalogTargets } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import {
  backfillLegacyBottleAliasTargetInTransaction,
  reserveLegacyPromotionCanonicalAliasInTransaction,
} from "./catalogMigrationBottleAliases";

async function getExactTargetId(bottleId: number) {
  const target = await db.query.catalogTargets.findFirst({
    where: eq(catalogTargets.bottleId, bottleId),
  });
  if (!target) throw new Error("Exact target fixture not found.");
  return target.id;
}

describe("catalog migration Bottle aliases", () => {
  test("backfills only target evidence and is idempotent", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: bottle.id });
    const targetId = await getExactTargetId(bottle.id);
    const alias = await fixtures.BottleAlias({
      name: "Migration Evidence Alias",
      bottleId: bottle.id,
      releaseId: release.id,
      targetId: null,
    });

    const first = await db.transaction((tx) =>
      backfillLegacyBottleAliasTargetInTransaction(tx, alias, targetId),
    );
    const persisted = await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, alias.name),
    });
    if (!persisted) throw new Error("Bottle alias not found.");
    const second = await db.transaction((tx) =>
      backfillLegacyBottleAliasTargetInTransaction(tx, persisted, targetId),
    );

    expect(first).toBe("updated");
    expect(second).toBe("reused");
    expect(persisted).toMatchObject({
      bottleId: bottle.id,
      releaseId: release.id,
      targetId,
    });
  });

  test("preserves the target-era promotion behavior behind migration ownership", async ({
    fixtures,
  }) => {
    const legacy = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({ bottleId: legacy.id });
    const promoted = await fixtures.Bottle();
    const targetId = await getExactTargetId(promoted.id);
    await db
      .update(bottleAliases)
      .set({
        bottleId: legacy.id,
        releaseId: release.id,
        targetId: null,
      })
      .where(eq(bottleAliases.name, release.fullName));

    await db.transaction((tx) =>
      reserveLegacyPromotionCanonicalAliasInTransaction(tx, {
        name: release.fullName,
        promotedBottleId: promoted.id,
        targetId,
        legacyBottleId: legacy.id,
        legacyReleaseId: release.id,
        assignedByActorId: promoted.createdByActorId,
      }),
    );

    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, release.fullName),
      }),
    ).toMatchObject({
      bottleId: promoted.id,
      releaseId: null,
      targetId,
      assignmentSource: "canonical",
    });
  });
});
