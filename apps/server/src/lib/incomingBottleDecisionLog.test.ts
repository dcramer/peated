import { db } from "@peated/server/db";
import { incomingBottleDecisionLogs } from "@peated/server/db/schema";
import { getPeatedSystemActor } from "@peated/server/lib/actors";
import {
  getIncomingBottleDecisionFromResolutionSource,
  recordIncomingBottleDecisionInTransaction,
} from "@peated/server/lib/incomingBottleDecisionLog";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("getIncomingBottleDecisionFromResolutionSource", () => {
  test("uses concrete vocabulary only for supported resolution sources", () => {
    expect(
      getIncomingBottleDecisionFromResolutionSource(
        "classifier_create_bottle",
        { createdBottle: true },
      ),
    ).toBe("create_bottle");
    expect(
      getIncomingBottleDecisionFromResolutionSource(
        "classifier_create_bottle",
        { createdBottle: false },
      ),
    ).toBe("match");

    for (const obsoleteSource of [
      "classifier_create_release",
      "classifier_create_bottle_and_release",
      "classifier_repair_parent_and_create_release",
    ]) {
      expect(
        getIncomingBottleDecisionFromResolutionSource(obsoleteSource, {
          createdBottle: true,
        }),
      ).toBeNull();
      expect(
        getIncomingBottleDecisionFromResolutionSource(obsoleteSource, {
          createdBottle: false,
        }),
      ).toBeNull();
    }
  });
});

describe("recordIncomingBottleDecisionInTransaction", () => {
  test("keeps later corrections and deduplicates concurrent retries", async ({
    fixtures,
  }) => {
    const actor = await getPeatedSystemActor();
    const first = await fixtures.Bottle();
    const second = await fixtures.Bottle();
    const site = await fixtures.ExternalSiteOrExisting();
    const record = (bottleId: number | null) =>
      db.transaction((tx) =>
        recordIncomingBottleDecisionInTransaction(tx, {
          sourceKind: "review",
          sourceId: 42,
          externalSiteId: site.id,
          name: "Repeated listing",
          actor,
          decision: bottleId === null ? "unassign" : "match",
          bottleId,
        }),
      );
    expect(await record(first.id)).not.toBeNull();
    const retries = await Promise.all([record(first.id), record(first.id)]);
    expect(retries).toEqual([null, null]);
    expect(await record(second.id)).not.toBeNull();
    expect(await record(null)).not.toBeNull();
    expect(await record(first.id)).not.toBeNull();
    const logs = await db.query.incomingBottleDecisionLogs.findMany({
      where: eq(incomingBottleDecisionLogs.sourceId, 42),
      orderBy: incomingBottleDecisionLogs.id,
    });
    expect(logs.map(({ bottleId }) => bottleId)).toEqual([
      first.id,
      second.id,
      null,
      first.id,
    ]);
  });
  test("writes one Bottle identity without legacy release or target claims", async ({
    fixtures,
  }) => {
    const actor = await getPeatedSystemActor();
    const bottle = await fixtures.Bottle();
    const site = await fixtures.ExternalSiteOrExisting();

    const result = await db.transaction((tx) =>
      recordIncomingBottleDecisionInTransaction(tx, {
        sourceKind: "review",
        sourceId: 42,
        externalSiteId: site.id,
        name: "Direct Bottle decision",
        decision: "create_bottle",
        actor,
        bottleId: bottle.id,
        createdBottle: true,
      }),
    );
    if (!result) throw new Error("Missing incoming Bottle decision fixture");

    expect(result).toMatchObject({
      bottleId: bottle.id,
      createdBottle: true,
      createdRelease: false,
    });
    expect(
      await db.query.incomingBottleDecisionLogs.findFirst({
        where: eq(incomingBottleDecisionLogs.id, result.id),
      }),
    ).toMatchObject({
      bottleId: bottle.id,
      createdBottle: true,
      createdRelease: false,
    });
  });
});
