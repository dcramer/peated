import { db } from "@peated/server/db";
import { bottleAliases, catalogTargets } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq, isNull } from "drizzle-orm";

describe("GET /bottle-groups/:group/aliases", () => {
  test("lists only active aliases owned by the generic target", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Alias Ownership" });
    const unrelated = await fixtures.Bottle({ name: "Unrelated Alias" });
    const [genericTarget, exactTarget] = await Promise.all([
      db.query.catalogTargets.findFirst({
        where: and(
          eq(catalogTargets.groupId, bottle.groupId as number),
          isNull(catalogTargets.bottleId),
        ),
      }),
      db.query.catalogTargets.findFirst({
        where: eq(catalogTargets.bottleId, bottle.id),
      }),
    ]);
    if (!genericTarget || !exactTarget) {
      throw new Error("Missing CatalogTarget fixture");
    }

    await db.insert(bottleAliases).values([
      {
        bottleId: unrelated.id,
        targetId: genericTarget.id,
        name: "Generic Alias A",
        assignmentSource: "human_approved",
        assignedByActorId: bottle.createdByActorId,
      },
      {
        bottleId: bottle.id,
        targetId: genericTarget.id,
        name: "Generic Alias B",
        assignmentSource: "source_approved",
        assignedByActorId: bottle.createdByActorId,
      },
      {
        bottleId: bottle.id,
        targetId: genericTarget.id,
        name: "Ignored Generic Alias",
        ignored: true,
        assignedByActorId: bottle.createdByActorId,
      },
      {
        bottleId: bottle.id,
        targetId: exactTarget.id,
        name: "Exact Alias",
        assignedByActorId: bottle.createdByActorId,
      },
      {
        bottleId: bottle.id,
        targetId: null,
        name: "Targetless Alias",
        assignedByActorId: bottle.createdByActorId,
      },
    ]);

    const firstPage = await routerClient.bottleGroups.aliases({
      group: bottle.groupId as number,
      limit: 1,
    });
    const secondPage = await routerClient.bottleGroups.aliases({
      group: bottle.groupId as number,
      cursor: 2,
      limit: 1,
    });

    expect(firstPage.results).toEqual([
      expect.objectContaining({
        name: "Generic Alias A",
        assignmentSource: "human_approved",
      }),
    ]);
    expect(firstPage.rel).toEqual({ nextCursor: 2, prevCursor: null });
    expect(secondPage.results).toEqual([
      expect.objectContaining({
        name: "Generic Alias B",
        assignmentSource: "source_approved",
      }),
    ]);
    expect(secondPage.rel).toEqual({ nextCursor: null, prevCursor: 1 });
  });

  test("returns not found rather than an empty page for an unknown group", async () => {
    const error = await waitError(
      routerClient.bottleGroups.aliases({ group: 999_999 }),
    );

    expect(error.message).toBe("Catalog target not found (groupId=999999).");
  });
});
