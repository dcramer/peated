import { db } from "@peated/server/db";
import { reviews } from "@peated/server/db/schema";
import * as workerClient from "@peated/server/worker/client";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";
import onBottleAliasChange from "./onBottleAliasChange";

vi.mock("@peated/server/worker/client", () => ({
  runJob: vi.fn(),
}));

describe("onBottleAliasChange", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("assigns matching reviews to the release alias target", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      edition: "Batch 4",
    });
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      releaseId: release.id,
      name: release.fullName,
    });
    const review = await fixtures.Review({
      bottleId: null,
      releaseId: null,
      name: release.fullName,
    });

    await onBottleAliasChange({ name: release.fullName });

    const updatedReview = await db.query.reviews.findFirst({
      where: eq(reviews.id, review.id),
    });

    expect(updatedReview).toMatchObject({
      bottleId: bottle.id,
      releaseId: release.id,
    });
    expect(workerClient.runJob).toHaveBeenCalledWith("IndexBottleAlias", {
      name: release.fullName,
    });
  });
});
