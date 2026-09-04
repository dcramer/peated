import waitError from "@peated/server/lib/test/waitError";
import { pushUniqueJob } from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";

describe("POST /admin/catalog/repair-bottle-counts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("queues one active repair for an administrator", async ({
    fixtures,
  }) => {
    const admin = await fixtures.User({ admin: true });

    await expect(
      routerClient.admin.repairBottleCounts({}, { context: { user: admin } }),
    ).resolves.toEqual({ status: "queued" });
    expect(pushUniqueJob).toHaveBeenCalledTimes(4);
    expect(pushUniqueJob).toHaveBeenNthCalledWith(
      1,
      "RepairEntityBottleCounts",
      {},
      {
        delay: 0,
      },
    );
    expect(pushUniqueJob).toHaveBeenNthCalledWith(
      2,
      "RepairLocationBottleCounts",
      {},
      {
        delay: 0,
      },
    );
    expect(pushUniqueJob).toHaveBeenNthCalledWith(
      3,
      "RepairBottleGroupBottleCounts",
      {},
      {
        delay: 0,
      },
    );
    expect(pushUniqueJob).toHaveBeenNthCalledWith(
      4,
      "RepairBottleSeriesReleaseCounts",
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
        routerClient.admin.repairBottleCounts({}, { context: { user } }),
      ),
    ).resolves.toMatchObject({ message: "Unauthorized." });
    expect(pushUniqueJob).not.toHaveBeenCalled();
  });
});
