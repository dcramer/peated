import { db } from "@peated/server/db";
import {
  bottleChecks,
  bottleOperations,
  incomingBottleDecisionLogs,
} from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import { BOTTLE_CHECK_SCHEMA_VERSION } from "@peated/server/lib/bottleChecks";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("admin moderation history", () => {
  test("unifies durable decisions and returns source-owned detail", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });
    const reviewer = await fixtures.User({ username: "history-reviewer" });
    const actor = await getUserActor(reviewer);
    const site = await fixtures.ExternalSiteOrExisting({ type: "totalwine" });
    const bottle = await fixtures.Bottle();
    const price = await fixtures.StorePrice({
      bottleId: null,
      externalSiteId: site.id,
      name: "History listing",
      url: "https://example.com/history-listing",
    });
    const [incoming] = await db
      .insert(incomingBottleDecisionLogs)
      .values({
        sourceKind: "store_price",
        sourceId: price.id,
        externalSiteId: site.id,
        name: price.name,
        url: price.url,
        decision: "match_existing",
        actorId: actor.id,
        bottleId: bottle.id,
        rationale: "The durable identity matched.",
        createdAt: new Date("2026-02-03T00:00:00.000Z"),
      })
      .returning();
    const [check] = await db
      .insert(bottleChecks)
      .values({
        intent: "audit_bottle",
        origin: "moderator",
        bottleId: bottle.id,
        subjectKey: `audit:${bottle.id}:history-test`,
        schemaVersion: BOTTLE_CHECK_SCHEMA_VERSION,
        inputSnapshot: {},
        output: { summary: "History", findings: [] },
        closedById: reviewer.id,
        closeReason: "resolved_manually",
        closeNote: "Corrected in the editor.",
        closedAt: new Date("2026-02-02T00:00:00.000Z"),
      })
      .returning();
    const [operation] = await db
      .insert(bottleOperations)
      .values({
        checkId: check!.id,
        proposal: {
          type: "update_entity",
          input: {
            entityId: bottle.brandId,
            patch: { name: "Reviewed brand" },
          },
          rationale: "A durable proposal.",
          evidenceRefs: [],
        },
        status: "rejected",
        reviewedById: reviewer.id,
        reviewedAt: new Date("2026-02-04T00:00:00.000Z"),
        rejectionReason: "wrong_change",
        reviewerNote: "The source was ambiguous.",
      })
      .returning();

    const history = await routerClient.admin.moderation.listHistory(
      { limit: 100 },
      { context: { user: admin } },
    );
    expect(history.results.map(({ key }) => key)).toEqual([
      `operation:${operation!.id}`,
      `incoming:${incoming!.id}`,
      `closure:${check!.id}`,
    ]);

    const details = await routerClient.admin.moderation.historyDetails(
      { key: `operation:${operation!.id}` },
      { context: { user: admin } },
    );
    expect(details).toMatchObject({
      event: {
        actor: reviewer.username,
        outcome: "rejected",
      },
      note: "The source was ambiguous.",
      details: {
        rejectionReason: "wrong_change",
      },
    });
    expect(details.activity.map(({ label }) => label)).toEqual([
      "Suggestion created",
      "Review recorded",
    ]);
  });
});
