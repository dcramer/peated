import { db } from "@peated/server/db";
import * as workerClient from "@peated/server/worker/client";
import { beforeEach, expect, test, vi } from "vitest";
import onBottleChange, { buildBottleChangeStatsJob } from "./onBottleChange";

beforeEach(() => {
  vi.mocked(workerClient.runJob).mockClear();
  vi.mocked(workerClient.pushUniqueJob).mockClear();
});

test("builds target-authoritative statistics work", () => {
  expect(buildBottleChangeStatsJob(42)).toEqual({
    name: "UpdateBottleStats",
    args: { targetId: 42 },
    opts: { delay: 5000, removeOnComplete: true, removeOnFail: false },
  });
});

test("derives Bottle work from an active exact target", async ({
  fixtures,
}) => {
  const bottle = await fixtures.Bottle();
  const target = await db.query.catalogTargets.findFirst({
    where: (catalogTargets, { eq }) => eq(catalogTargets.bottleId, bottle.id),
  });
  if (!target) throw new Error("Missing exact target fixture");

  await onBottleChange({ targetId: target.id });

  expect(workerClient.runJob).toHaveBeenCalledWith("GenerateBottleDetails", {
    bottleId: bottle.id,
  });
  expect(workerClient.runJob).toHaveBeenCalledWith("IndexBottleSearchVectors", {
    bottleId: bottle.id,
  });
  expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
    "UpdateBottleStats",
    { targetId: target.id },
    { delay: 5000, removeOnComplete: true, removeOnFail: false },
  );
});

test("rejects generic, missing, and legacy Bottle payloads", async ({
  fixtures,
}) => {
  const bottle = await fixtures.Bottle();
  const genericTarget = await db.query.catalogTargets.findFirst({
    where: (catalogTargets, { and, eq, isNull }) =>
      and(
        eq(catalogTargets.groupId, bottle.groupId as number),
        isNull(catalogTargets.bottleId),
      ),
  });
  if (!genericTarget) throw new Error("Missing generic target fixture");

  await expect(onBottleChange({ targetId: genericTarget.id })).rejects.toThrow(
    "OnBottleChange requires an exact Bottle target",
  );
  await expect(onBottleChange({ targetId: 2_000_000_000 })).rejects.toThrow(
    "Catalog target not found",
  );
  await expect(onBottleChange({ bottleId: bottle.id })).rejects.toThrow();
});
