import { db } from "@peated/server/db";
import { bottleChecks, changes } from "@peated/server/db/schema";
import { and, eq } from "drizzle-orm";
import { beforeEach, vi } from "vitest";
import type { JobPayload } from "../types";
import {
  verifyBottleCreation as verifyBottleCreationWithServices,
  type VerifyBottleCreationServices,
} from "./verifyBottleCreation";

let runAudit: ReturnType<
  typeof vi.fn<VerifyBottleCreationServices["runAudit"]>
>;

function verifyBottleCreation(input: JobPayload) {
  return verifyBottleCreationWithServices(input, { runAudit });
}

describe("verifyBottleCreation", () => {
  beforeEach(() => {
    runAudit = vi.fn();
  });

  test("records skipped results for trusted creation flows", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();

    await verifyBottleCreation({
      bottleId: bottle.id,
      creationSource: "price_match_review",
    });

    const bottleChanges = await db
      .select()
      .from(changes)
      .where(
        and(eq(changes.objectType, "bottle"), eq(changes.objectId, bottle.id)),
      );
    const verificationChange = bottleChanges.find(
      (change) => change.data?.catalogVerification?.phase === "result",
    );

    expect(verificationChange?.data.catalogVerification).toMatchObject({
      source: "price_match_review",
      status: "skipped",
    });
    expect(runAudit).not.toHaveBeenCalled();
  });

  test("skips a second audit for automated price-match Bottles", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    await verifyBottleCreation({
      bottleId: bottle.id,
      creationSource: "price_match_automation" as const,
    });

    expect(runAudit).not.toHaveBeenCalled();
    expect(
      await db
        .select()
        .from(bottleChecks)
        .where(
          eq(bottleChecks.backgroundEventKey, `bottle_created:${bottle.id}`),
        ),
    ).toEqual([]);

    const bottleChanges = await db
      .select()
      .from(changes)
      .where(
        and(eq(changes.objectType, "bottle"), eq(changes.objectId, bottle.id)),
      );
    const verificationChange = bottleChanges.find(
      (change) => change.data?.catalogVerification?.phase === "result",
    );
    expect(verificationChange?.data.catalogVerification).toMatchObject({
      source: "price_match_automation",
      status: "skipped",
    });
  });

  test("skips stale verification for a deleted Bottle", async () => {
    await expect(
      verifyBottleCreation({
        bottleId: 2_147_483_647,
        creationSource: "manual_entry",
      }),
    ).resolves.toBeUndefined();
    expect(runAudit).not.toHaveBeenCalled();
  });

  test("fails for retry without falling back to the old heuristic conclusion", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    runAudit.mockRejectedValue(new Error("classifier unavailable"));

    await expect(
      verifyBottleCreation({
        bottleId: bottle.id,
        creationSource: "manual_entry",
      }),
    ).rejects.toThrow("classifier unavailable");

    const bottleChanges = await db
      .select()
      .from(changes)
      .where(
        and(eq(changes.objectType, "bottle"), eq(changes.objectId, bottle.id)),
      );
    expect(
      bottleChanges.some(
        (change) => change.data?.catalogVerification?.phase === "result",
      ),
    ).toBe(false);
    expect(
      await db
        .select({ id: bottleChecks.id })
        .from(bottleChecks)
        .where(
          eq(bottleChecks.backgroundEventKey, `bottle_created:${bottle.id}`),
        ),
    ).toEqual([]);
  });
});
