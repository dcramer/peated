import * as workerClient from "@peated/server/lib/test/workerDispatch";
import { updateEntity } from "@peated/server/lib/updateEntity";
import { beforeEach, expect, test, vi } from "vitest";

beforeEach(() => {
  vi.mocked(workerClient.pushUniqueJob).mockReset();
  vi.mocked(workerClient.pushUniqueJob).mockResolvedValue(undefined);
});

test("an Entity name change reindexes every related Bottle", async ({
  fixtures,
}) => {
  const entity = await fixtures.Entity({
    name: "Shared Search Entity",
    kind: "distillery",
  });
  const brandBottle = await fixtures.Bottle({ brandId: entity.id });
  const bottlerBottle = await fixtures.Bottle({ bottlerId: entity.id });
  const distillerBottle = await fixtures.Bottle({ distillerIds: [entity.id] });
  const moderator = await fixtures.User({ mod: true });

  await updateEntity({
    entityId: entity.id,
    input: { name: "Renamed Search Entity" },
    user: moderator,
  });

  const indexedBottleIds = vi
    .mocked(workerClient.pushUniqueJob)
    .mock.calls.filter(([job]) => job === "IndexBottleSearchVectors")
    .flatMap(([, input]) =>
      input !== undefined && "bottleId" in input ? [input.bottleId] : [],
    );
  expect(new Set(indexedBottleIds)).toEqual(
    new Set([brandBottle.id, bottlerBottle.id, distillerBottle.id]),
  );
});
