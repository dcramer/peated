import { db } from "@peated/server/db";
import { bottles, catalogTargets } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { getExactCatalogTargetStatsRepairPage } from "./catalogTargetStatsRepair";

describe("exact CatalogTarget stats repair selection", () => {
  test("returns only exact targets in Bottle order", async ({ fixtures }) => {
    const first = await fixtures.Bottle();
    const second = await fixtures.Bottle();
    const legacy = await fixtures.LegacyBottle();
    const targetless = await fixtures.LegacyBottle();
    await db
      .update(bottles)
      .set({ groupId: first.groupId })
      .where(eq(bottles.id, targetless.id));

    const page = await getExactCatalogTargetStatsRepairPage({
      limit: 100,
    });

    expect(page.map(({ bottleId }) => bottleId)).toContain(first.id);
    expect(page.map(({ bottleId }) => bottleId)).toContain(second.id);
    expect(page.map(({ bottleId }) => bottleId)).not.toContain(legacy.id);
    expect(page.map(({ bottleId }) => bottleId)).not.toContain(targetless.id);
    expect(page.map(({ bottleId }) => bottleId)).toEqual(
      [...page.map(({ bottleId }) => bottleId)].sort((a, b) => a - b),
    );
  });

  test("filters requested Bottle IDs and paginates exact identities", async ({
    fixtures,
  }) => {
    const exact = await Promise.all([
      fixtures.Bottle(),
      fixtures.Bottle(),
      fixtures.Bottle(),
    ]);
    const unrequested = await fixtures.Bottle();
    const legacy = await fixtures.LegacyBottle();
    const requestedIds = [exact[2].id, legacy.id, exact[0].id, exact[1].id];

    const firstPage = await getExactCatalogTargetStatsRepairPage({
      bottleIds: requestedIds,
      limit: 2,
    });
    const secondPage = await getExactCatalogTargetStatsRepairPage({
      bottleIds: requestedIds,
      limit: 2,
      offset: 2,
    });
    const rows = [...firstPage, ...secondPage];
    const targetIds = await db
      .select({
        targetId: catalogTargets.id,
        bottleId: catalogTargets.bottleId,
      })
      .from(catalogTargets)
      .where(eq(catalogTargets.groupId, exact[0].groupId as number));

    expect(rows.map(({ bottleId }) => bottleId)).toEqual(
      exact.map(({ id }) => id).sort((a, b) => a - b),
    );
    expect(rows.map(({ bottleId }) => bottleId)).not.toContain(unrequested.id);
    expect(rows.map(({ bottleId }) => bottleId)).not.toContain(legacy.id);
    expect(rows[0]?.targetId).toBe(
      targetIds.find(({ bottleId }) => bottleId === exact[0].id)?.targetId,
    );
  });
});
