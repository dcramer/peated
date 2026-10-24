import waitError from "@peated/server/lib/test/waitError";
import { pushJob } from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";

describe("POST /admin/catalog/rebuild-summaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("queues one active repair for an administrator", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });

    await expect(
      routerClient.admin.rebuildCatalogSummaries(
        {},
        { context: { user: admin } },
      ),
    ).resolves.toEqual({ status: "queued" });
    expect(pushJob).toHaveBeenCalledTimes(6);
    expect(pushJob).toHaveBeenNthCalledWith(
      1,
      "RepairBottleStats",
      {},
      {
        delay: 0,
      },
    );
    expect(pushJob).toHaveBeenNthCalledWith(
      2,
      "RepairEntityBottleCounts",
      {},
      {
        delay: 0,
      },
    );
    expect(pushJob).toHaveBeenNthCalledWith(
      3,
      "RepairLocationBottleCounts",
      {},
      {
        delay: 0,
      },
    );
    expect(pushJob).toHaveBeenNthCalledWith(
      4,
      "RepairBottleGroupBottleCounts",
      {},
      {
        delay: 0,
      },
    );
    expect(pushJob).toHaveBeenNthCalledWith(
      5,
      "RepairBottleSeriesReleaseCounts",
      {},
      {
        delay: 0,
      },
    );
    expect(pushJob).toHaveBeenNthCalledWith(
      6,
      "RepairCollectionBottleCounts",
      {},
      {
        delay: 0,
      },
    );
  });

  test("requires an administrator", async ({ fixtures }) => {
    const user = await fixtures.User();

    await expect(
      waitError(
        routerClient.admin.rebuildCatalogSummaries({}, { context: { user } }),
      ),
    ).resolves.toMatchObject({ message: "Unauthorized." });
    expect(pushJob).not.toHaveBeenCalled();
  });
});
