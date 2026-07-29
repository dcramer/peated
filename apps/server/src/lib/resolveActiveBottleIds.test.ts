import { db } from "@peated/server/db";
import { bottleTombstones } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { expect, test } from "vitest";
import {
  ActiveBottleSelectionError,
  resolveActiveBottleIds,
} from "./resolveActiveBottleIds";

test("canonicalizes active Bottle ids", async ({ fixtures }) => {
  const first = await fixtures.Bottle();
  const second = await fixtures.Bottle();

  await expect(
    db.transaction((tx) =>
      resolveActiveBottleIds(tx, [second.id, first.id, second.id]),
    ),
  ).resolves.toEqual(
    [first.id, second.id].toSorted((left, right) => left - right),
  );
});

test("supports exclusive Bottle locks for direct consumer writers", async ({
  fixtures,
}) => {
  const bottle = await fixtures.Bottle();

  await expect(
    db.transaction((tx) =>
      resolveActiveBottleIds(tx, [bottle.id], { lock: "update" }),
    ),
  ).resolves.toEqual([bottle.id]);
});

test("rejects every inactive Bottle state", async ({ fixtures }) => {
  const unassigned = await fixtures.LegacyBottle();

  const retired = await fixtures.Bottle();
  const bottleReplacement = await fixtures.Bottle();
  await db.insert(bottleTombstones).values({
    bottleId: retired.id,
    newBottleId: bottleReplacement.id,
  });

  const scenarios = [
    { bottleId: Number.MAX_SAFE_INTEGER, reason: "missing" },
    { bottleId: unassigned.id, reason: "unassigned" },
    { bottleId: retired.id, reason: "bottle_retired" },
  ] as const;

  for (const scenario of scenarios) {
    const error = await waitError(() =>
      db.transaction((tx) => resolveActiveBottleIds(tx, [scenario.bottleId])),
    );

    expect(error).toBeInstanceOf(ActiveBottleSelectionError);
    expect(error).toMatchObject({
      reason: scenario.reason,
      bottleId: scenario.bottleId,
    });
  }
});
