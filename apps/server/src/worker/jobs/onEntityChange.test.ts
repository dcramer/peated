import * as workerClient from "@peated/server/lib/test/workerDispatch";
import { beforeEach, expect, test, vi } from "vitest";
import onEntityChange from "./onEntityChange";

beforeEach(() => {
  vi.mocked(workerClient.runJob).mockClear();
  vi.mocked(workerClient.pushUniqueJob).mockClear();
});

test("dispatches derived work for an existing Entity", async ({ fixtures }) => {
  const entity = await fixtures.Entity();

  await onEntityChange({ entityId: entity.id });

  expect(workerClient.runJob).toHaveBeenNthCalledWith(
    1,
    "GenerateEntityDetails",
    { entityId: entity.id },
  );
  expect(workerClient.runJob).toHaveBeenNthCalledWith(
    2,
    "IndexEntitySearchVectors",
    { entityId: entity.id },
  );
  expect(workerClient.runJob).toHaveBeenNthCalledWith(
    3,
    "GeocodeEntityLocation",
    { entityId: entity.id },
  );
  expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
    "UpdateEntityStats",
    { entityId: entity.id },
    { delay: 5000 },
  );
});

test("skips stale work for a deleted Entity", async () => {
  await onEntityChange({ entityId: 2_147_483_647 });

  expect(workerClient.runJob).not.toHaveBeenCalled();
  expect(workerClient.pushUniqueJob).not.toHaveBeenCalled();
});
