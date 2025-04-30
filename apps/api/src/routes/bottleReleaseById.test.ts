import { describe, expect, it } from "vitest";
import waitError from "../lib/test/waitError";
import { createCaller } from "../trpc/router";

describe("bottleReleaseById", function () {
  it("returns a bottle release", async function ({ fixtures }) {
    const caller = createCaller();

    const bottle = await fixtures.Bottle({
      name: "Test Bottle",
      category: "single_malt",
    });

    const release = await fixtures.BottleRelease({
      bottleId: bottle.id,
      abv: 40,
    });

    const result = await caller.bottleReleaseById(release.id);

    expect(result.id).toBe(release.id);
    expect(result.bottleId).toBe(bottle.id);
    expect(result.name).toBe(release.name);
    expect(result.abv).toBe(40);
  });

  it("errors on invalid release", async function () {
    const caller = createCaller();

    const err = await waitError(caller.bottleReleaseById(1234));
    expect(err).toMatchInlineSnapshot(`[TRPCError: Release not found.]`);
  });
});
