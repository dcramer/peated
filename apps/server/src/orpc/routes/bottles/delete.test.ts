import { db } from "@peated/server/db";
import {
  bottles,
  storePriceMatchProposals,
  storePrices,
} from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("DELETE /bottles/:bottle", () => {
  test("deletes bottle", async ({ fixtures }) => {
    const user = await fixtures.User({ admin: true });
    const bottle = await fixtures.Bottle();

    const data = await routerClient.bottles.delete(
      { bottle: bottle.id },
      {
        context: { user },
      },
    );
    expect(data).toEqual({});

    const [newBottle] = await db
      .select()
      .from(bottles)
      .where(eq(bottles.id, bottle.id));
    expect(newBottle).toBeUndefined();
  });

  test("requires admin", async ({ fixtures }) => {
    const user = await fixtures.User();
    const bottle = await fixtures.Bottle();

    const err = await waitError(
      routerClient.bottles.delete({ bottle: bottle.id }, { context: { user } }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("clears store price proposal references to the deleted bottle", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ admin: true });
    const bottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({ bottleId: bottle.id });
    const reviewer = await fixtures.User();

    const [proposal] = await db
      .insert(storePriceMatchProposals)
      .values({
        priceId: price.id,
        status: "approved",
        proposalType: "match_existing",
        currentBottleId: bottle.id,
        suggestedBottleId: bottle.id,
        reviewedById: reviewer.id,
        reviewedAt: new Date("2026-03-11T00:30:00.000Z"),
      })
      .returning();

    await routerClient.bottles.delete(
      { bottle: bottle.id },
      {
        context: { user },
      },
    );

    const updatedPrice = await db.query.storePrices.findFirst({
      where: eq(storePrices.id, price.id),
    });
    const updatedProposal = await db.query.storePriceMatchProposals.findFirst({
      where: eq(storePriceMatchProposals.id, proposal.id),
    });

    expect(updatedPrice?.bottleId).toBeNull();
    expect(updatedProposal).toMatchObject({
      currentBottleId: null,
      suggestedBottleId: null,
      status: "pending_review",
      reviewedById: null,
      reviewedAt: null,
    });
  });
});
