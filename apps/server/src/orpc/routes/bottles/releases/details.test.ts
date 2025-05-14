import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, it } from "vitest";

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

    const result = await routerClient.bottles.releases.details({
      id: release.id,
    });

    expect(result.id).toBe(release.id);
    expect(result.bottleId).toBe(bottle.id);
    expect(result.name).toBe(release.name);
    expect(result.abv).toBe(40);
  });

  it("errors on invalid release", async function () {
    const err = await waitError(
      routerClient.bottles.releases.details({
        id: 1234,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Release not found.]`);
  });
});
