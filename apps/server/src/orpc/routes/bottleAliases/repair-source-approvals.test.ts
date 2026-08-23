import { db } from "@peated/server/db";
import {
  bottleAliases,
  changes,
  incomingBottleDecisionLogs,
  storePriceMatchProposals,
} from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("POST /bottle-aliases/repair-source-approvals", () => {
  test("requires moderator access", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: false });

    const error = await waitError(
      routerClient.bottleAliases.repairSourceApprovals(
        {},
        { context: { user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("previews by default and applies only an explicitly named repair", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const actor = await getUserActor(user);
    const bottle = await fixtures.Bottle({ name: "API Cleanup Bottle" });
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const price = await fixtures.StorePrice({
      externalSiteId: site.id,
      name: "API Cleanup Listing",
      bottleId: bottle.id,
    });
    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "approved",
        proposalType: "match_existing",
        aliasScope: "none",
        currentBottleId: bottle.id,
        suggestedBottleId: bottle.id,
        reviewedById: user.id,
      })
      .returning();
    await db.insert(incomingBottleDecisionLogs).values({
      sourceKind: "store_price",
      sourceId: price.id,
      proposalId: proposal.id,
      externalSiteId: site.id,
      name: price.name,
      decision: "match_existing",
      actorId: actor.id,
      bottleId: bottle.id,
    });
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: price.name,
      ignored: true,
      assignmentSource: "source_approved",
      assignedByActorId: actor.id,
    });

    const preview = await routerClient.bottleAliases.repairSourceApprovals(
      { aliasNames: [price.name] },
      { context: { user } },
    );

    expect(preview).toMatchObject({
      items: [
        {
          aliasName: price.name,
          bottleId: bottle.id,
          evidenceProposalIds: [proposal.id],
          status: "planned",
        },
      ],
      nextAliasName: null,
      summary: { applied: 0, planned: 1, reviewRequired: 0, total: 1 },
    });
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, price.name),
      }),
    ).toMatchObject({ bottleId: bottle.id });

    const applied = await routerClient.bottleAliases.repairSourceApprovals(
      { aliasNames: [price.name], execute: true },
      { context: { user } },
    );

    expect(applied.summary).toMatchObject({ applied: 1, failed: 0 });
    expect(
      await db.query.bottleAliases.findFirst({
        where: eq(bottleAliases.name, price.name),
      }),
    ).toMatchObject({ bottleId: null });
    expect(
      await db.query.changes.findFirst({
        where: and(
          eq(changes.objectType, "bottle"),
          eq(changes.objectId, bottle.id),
        ),
        orderBy: (table, { desc }) => desc(table.id),
      }),
    ).toMatchObject({
      actorId: actor.id,
      data: expect.objectContaining({
        updateScope: "bottle_alias_repair",
        aliasName: price.name,
      }),
    });
  });

  test("requires explicit names for execution", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    const error = await waitError(
      routerClient.bottleAliases.repairSourceApprovals(
        { execute: true },
        { context: { user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Input validation failed]`);
  });

  test("rejects a preview cursor combined with explicit names", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });

    const error = await waitError(
      routerClient.bottleAliases.repairSourceApprovals(
        { afterAliasName: "Cursor", aliasNames: ["Named Alias"] },
        { context: { user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Input validation failed]`);
  });

  test("continues a broad preview from the returned alias cursor", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const actor = await getUserActor(user);
    const bottle = await fixtures.Bottle({ name: "API Cursor Bottle" });
    for (const name of ["API Cursor A", "API Cursor B"]) {
      await fixtures.BottleAlias({
        bottleId: bottle.id,
        name,
        ignored: false,
        assignmentSource: "source_approved",
        assignedByActorId: actor.id,
      });
    }

    const firstPage = await routerClient.bottleAliases.repairSourceApprovals(
      { limit: 1 },
      { context: { user } },
    );
    expect(firstPage.items.map(({ aliasName }) => aliasName)).toEqual([
      "API Cursor A",
    ]);
    expect(firstPage.nextAliasName).toBe("API Cursor A");

    const secondPage = await routerClient.bottleAliases.repairSourceApprovals(
      { afterAliasName: firstPage.nextAliasName!, limit: 1 },
      { context: { user } },
    );
    expect(secondPage.items.map(({ aliasName }) => aliasName)).toEqual([
      "API Cursor B",
    ]);
    expect(secondPage.nextAliasName).toBeNull();
  });
});
