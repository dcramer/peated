import { db } from "@peated/server/db";
import {
  bottleGroupTombstones,
  bottleTombstones,
} from "@peated/server/db/schema";
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

test("rejects every inactive Bottle state", async ({ fixtures }) => {
  const unassigned = await fixtures.LegacyBottle();

  const retired = await fixtures.Bottle();
  const bottleReplacement = await fixtures.Bottle();
  await db.insert(bottleTombstones).values({
    bottleId: retired.id,
    newBottleId: bottleReplacement.id,
  });

  const retiredGroupMember = await fixtures.Bottle();
  const groupReplacement = await fixtures.Bottle();
  if (
    retiredGroupMember.groupId === null ||
    groupReplacement.groupId === null
  ) {
    throw new Error("BottleGroup fixtures not found.");
  }
  await db.insert(bottleGroupTombstones).values({
    groupId: retiredGroupMember.groupId,
    newGroupId: groupReplacement.groupId,
    createdByActorId: retiredGroupMember.createdByActorId,
  });

  const scenarios = [
    { bottleId: Number.MAX_SAFE_INTEGER, reason: "missing" },
    { bottleId: unassigned.id, reason: "unassigned" },
    { bottleId: retired.id, reason: "bottle_retired" },
    { bottleId: retiredGroupMember.id, reason: "group_retired" },
  ] as const;

  for (const scenario of scenarios) {
    const error = await waitError(() =>
      db.transaction((tx) => resolveActiveBottleIds(tx, [scenario.bottleId])),
    );

    expect(error).toBeInstanceOf(ActiveBottleSelectionError);
    expect(error).toMatchObject({ reason: scenario.reason });
  }
});
