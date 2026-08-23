import { db } from "@peated/server/db";
import {
  bottleAliases,
  changes,
  incomingBottleDecisionLogs,
  storePriceMatchProposals,
} from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import { repairInvalidSourceBottleAliases } from "@peated/server/lib/repairInvalidSourceBottleAliases";
import { and, eq } from "drizzle-orm";
import { expect, test } from "vitest";

test("previews and explicitly unassigns a proven ignored source-only BottleAlias", async ({
  fixtures,
}) => {
  const user = await fixtures.User({ mod: true });
  const actor = await getUserActor(user);
  const bottle = await fixtures.Bottle({ name: "Specific Cleanup Bottle" });
  const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
  const price = await fixtures.StorePrice({
    externalSiteId: site.id,
    name: "Generic Cleanup Listing",
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

  const preview = await repairInvalidSourceBottleAliases({
    aliasNames: [price.name],
  });

  expect(preview.items).toEqual([
    expect.objectContaining({
      aliasName: price.name,
      bottleId: bottle.id,
      evidenceProposalIds: [proposal.id],
      status: "planned",
    }),
  ]);
  expect(
    await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, price.name),
    }),
  ).toMatchObject({ bottleId: bottle.id });

  const applied = await repairInvalidSourceBottleAliases({
    aliasNames: [price.name],
    dryRun: false,
    user,
  });

  expect(applied.summary).toMatchObject({ applied: 1, failed: 0 });
  expect(
    await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, price.name),
    }),
  ).toMatchObject({
    bottleId: null,
    ignored: true,
    assignmentSource: "source_approved",
  });
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
      evidenceProposalIds: [proposal.id],
    }),
  });
});

test("does not automatically repair an active BottleAlias", async ({
  fixtures,
}) => {
  const user = await fixtures.User({ mod: true });
  const actor = await getUserActor(user);
  const bottle = await fixtures.Bottle({ name: "Active Alias Bottle" });
  const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
  const price = await fixtures.StorePrice({
    externalSiteId: site.id,
    name: "Active Source Alias",
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
    ignored: false,
    assignmentSource: "source_approved",
    assignedByActorId: actor.id,
  });

  const result = await repairInvalidSourceBottleAliases({
    aliasNames: [price.name],
  });

  expect(result.items).toEqual([
    expect.objectContaining({
      aliasName: price.name,
      status: "review_required",
      message: "Active BottleAlias requires manual review.",
    }),
  ]);
  expect(
    await db.query.bottleAliases.findFirst({
      where: eq(bottleAliases.name, price.name),
    }),
  ).toMatchObject({ bottleId: bottle.id });
});

test("requires explicit BottleAlias names before execution", async ({
  fixtures,
}) => {
  const user = await fixtures.User({ mod: true });

  await expect(
    repairInvalidSourceBottleAliases({ dryRun: false, user }),
  ).rejects.toThrow("explicit BottleAlias names");
});
