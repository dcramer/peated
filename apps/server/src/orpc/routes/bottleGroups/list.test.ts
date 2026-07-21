import { db } from "@peated/server/db";
import {
  bottleAliases,
  bottleGroups,
  catalogTargets,
} from "@peated/server/db/schema";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq, isNull } from "drizzle-orm";

describe("GET /bottle-groups", () => {
  test("lists generic targets with deterministic pagination and sort", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Shared Brand" });
    const alpha = await fixtures.Bottle({
      brandId: brand.id,
      name: "Alpha Expression",
    });
    const beta = await fixtures.Bottle({
      brandId: brand.id,
      name: "Beta Expression",
    });
    await fixtures.Bottle({
      brandId: brand.id,
      name: "Gamma Expression",
    });

    await db
      .update(bottleGroups)
      .set({ totalTastings: 12 })
      .where(eq(bottleGroups.id, beta.groupId as number));

    const firstPage = await routerClient.bottleGroups.list({
      limit: 1,
      sort: "-tastings",
    });
    const secondPage = await routerClient.bottleGroups.list({
      cursor: 2,
      limit: 1,
      sort: "-tastings",
    });

    expect(firstPage.results).toHaveLength(1);
    expect(firstPage.results[0]).toMatchObject({
      kind: "group",
      group: { id: beta.groupId, totalTastings: 12 },
    });
    expect("bottle" in firstPage.results[0]).toBe(false);
    expect(firstPage.rel).toEqual({ nextCursor: 2, prevCursor: null });
    expect(secondPage.results).toHaveLength(1);
    expect(secondPage.rel.prevCursor).toBe(1);
    expect(secondPage.results[0].group.id).not.toBe(beta.groupId);
    expect(secondPage.results[0].group.id).toBe(alpha.groupId);
  });

  test("searches accepted aliases owned by a generic target", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Alias Search Group" });
    const genericTarget = await db.query.catalogTargets.findFirst({
      where: and(
        eq(catalogTargets.groupId, bottle.groupId as number),
        isNull(catalogTargets.bottleId),
      ),
    });
    if (!genericTarget) throw new Error("Missing generic target fixture");

    await db.insert(bottleAliases).values({
      bottleId: bottle.id,
      targetId: genericTarget.id,
      name: "Hidden Discovery Phrase",
      assignmentSource: "human_approved",
      assignedByActorId: bottle.createdByActorId,
    });

    const { results } = await routerClient.bottleGroups.list({
      query: "Discovery Phrase",
      sort: "name",
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      kind: "group",
      targetId: genericTarget.id,
      group: { id: bottle.groupId },
    });
  });
});
