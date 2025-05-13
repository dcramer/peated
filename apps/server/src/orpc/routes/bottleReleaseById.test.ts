import waitError from "@peated/server/lib/test/waitError";
import { describe, expect, it } from "vitest";
import { routerClient } from "../router";

describe("GET /bottle-releases/:id", function () {
  it("returns a bottle release", async function ({ fixtures }) {
    const bottle = await fixtures.Bottle({
      name: "Test Bottle",
      category: "single_malt",
    });

    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      abv: 40,
    });

    const result = await routerClient.bottleReleaseById({
      id: release.id,
    });

    expect(result.id).toBe(release.id);
    expect(result.bottleId).toBe(bottle.id);
    expect(result.name).toBe(release.name);
    expect(result.abv).toBe(40);
  });

  it("errors on invalid release", async function () {
    const err = await waitError(
      routerClient.bottleReleaseById({
        id: 1234,
      }),
    );
    expect(err).toMatchInlineSnapshot();
  });
});
