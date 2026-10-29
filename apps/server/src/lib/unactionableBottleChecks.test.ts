import { db } from "@peated/server/db";
import {
  bottleChecks,
  bottleOperations,
  bottleTombstones,
  type NewBottleOperation,
} from "@peated/server/db/schema";
import { BOTTLE_CHECK_SCHEMA_VERSION } from "@peated/server/lib/bottleChecks";
import waitError from "@peated/server/lib/test/waitError";
import { closeUnactionableBottleChecks } from "@peated/server/lib/unactionableBottleChecks";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

async function createCheck({
  bottleId,
  intent = "audit_bottle",
  sourceKind = null,
  findings = [],
  operations = [],
}: {
  bottleId: number | null;
  intent?: "audit_bottle" | "resolve_reference";
  sourceKind?: string | null;
  findings?: { summary: string }[];
  operations?: Pick<NewBottleOperation, "proposal" | "status">[];
}) {
  const [check] = await db
    .insert(bottleChecks)
    .values({
      intent,
      origin: intent === "audit_bottle" ? "moderator" : null,
      sourceKind,
      bottleId,
      subjectKey: `test:${bottleId}:${Math.random()}`,
      schemaVersion: BOTTLE_CHECK_SCHEMA_VERSION,
      inputSnapshot: {},
      output: { summary: "Test check", findings },
      completedAt: new Date(),
    })
    .returning();
  if (operations.length) {
    await db
      .insert(bottleOperations)
      .values(
        operations.map((operation) => ({ ...operation, checkId: check!.id })),
      );
  }
  return check!;
}

function updateBottle(bottleId: number): NewBottleOperation["proposal"] {
  return {
    type: "update_bottle",
    input: { bottleId, patch: { abv: 46 } },
    rationale: "The label states 46% ABV.",
    evidenceRefs: [{ kind: "bottle", bottleId }],
  };
}

async function closedState(checkId: number) {
  return await db.query.bottleChecks.findFirst({
    columns: { closedAt: true, closeReason: true, closeNote: true },
    where: eq(bottleChecks.id, checkId),
  });
}

describe("closeUnactionableBottleChecks", () => {
  test("closes checks with nothing left to act on and records why", async ({
    fixtures,
  }) => {
    const live = await fixtures.Bottle();
    const merged = await fixtures.Bottle();
    await db
      .insert(bottleTombstones)
      .values({ bottleId: merged.id, newBottleId: live.id });

    const unsupported = await createCheck({
      bottleId: live.id,
      operations: [
        {
          // SAFETY: this row deliberately stores a retired shape. caskFill was
          // removed from Bottles, so the current proposal type rejects it.
          proposal: {
            ...updateBottle(live.id),
            input: { bottleId: live.id, patch: { caskFill: "first_fill" } },
          } as never,
          status: "pending_review",
        },
      ],
    });
    const changeToMerged = await createCheck({
      bottleId: merged.id,
      operations: [
        { proposal: updateBottle(merged.id), status: "pending_review" },
      ],
    });
    const findingsOnDeleted = await createCheck({
      bottleId: null,
      findings: [{ summary: "The outturn looks wrong." }],
    });

    expect(await closeUnactionableBottleChecks()).toBe(3);

    expect(await closedState(unsupported.id)).toMatchObject({
      closedAt: expect.any(Date),
      closeReason: "no_longer_actionable",
      closeNote: expect.stringContaining("older format"),
    });
    for (const check of [changeToMerged, findingsOnDeleted]) {
      expect(await closedState(check.id)).toMatchObject({
        closedAt: expect.any(Date),
        closeReason: "no_longer_actionable",
        closeNote: expect.stringContaining("merged or deleted"),
      });
    }

    // A second run finds nothing more to close.
    expect(await closeUnactionableBottleChecks()).toBe(0);
  });

  test("keeps checks a moderator can still act on", async ({ fixtures }) => {
    const live = await fixtures.Bottle();
    const merged = await fixtures.Bottle();
    await db
      .insert(bottleTombstones)
      .values({ bottleId: merged.id, newBottleId: live.id });

    const oneLiveChange = await createCheck({
      bottleId: live.id,
      operations: [
        { proposal: updateBottle(merged.id), status: "pending_review" },
        { proposal: updateBottle(live.id), status: "blocked" },
      ],
    });
    const findingsOnLive = await createCheck({
      bottleId: live.id,
      findings: [{ summary: "The name drops the vintage." }],
    });
    const photoFindings = await createCheck({
      bottleId: null,
      intent: "resolve_reference",
      sourceKind: "photo_identification",
      findings: [{ summary: "The label shows a different strength." }],
    });
    const applying = await createCheck({
      bottleId: merged.id,
      operations: [{ proposal: updateBottle(merged.id), status: "applying" }],
    });

    expect(await closeUnactionableBottleChecks()).toBe(0);
    for (const check of [
      oneLiveChange,
      findingsOnLive,
      photoFindings,
      applying,
    ]) {
      expect(await closedState(check.id)).toMatchObject({ closedAt: null });
    }
  });

  test("moderators cannot choose the automatic close reason", async ({
    fixtures,
  }) => {
    const moderator = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    const check = await createCheck({
      bottleId: bottle.id,
      findings: [{ summary: "The name drops the vintage." }],
    });

    const error = await waitError(() =>
      routerClient.audits.close(
        // SAFETY: the route's input type already excludes this reason; the
        // test sends it anyway to prove the server rejects it.
        { audit: check.id, reason: "no_longer_actionable" as never },
        { context: { user: moderator } },
      ),
    );
    expect(error).toBeInstanceOf(Error);
    expect(await closedState(check.id)).toMatchObject({ closedAt: null });
  });
});
