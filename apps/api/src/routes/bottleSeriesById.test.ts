import waitError from "@peated/server/lib/test/waitError";
import { describe, expect, it } from "vitest";
import { createCaller } from "../trpc/router";

describe("bottleSeriesById", () => {
  it("returns a bottle series", async function ({ fixtures }) {
    const brand = await fixtures.Entity({ name: "Ardbeg" });
    const series = await fixtures.BottleSeries({
      name: "Supernova",
      description: "A limited edition series",
      brandId: brand.id,
    });

    const caller = createCaller();
    const result = await caller.bottleSeriesById(series.id);

    expect(result).toMatchObject({
      id: series.id,
      name: series.name,
      fullName: series.fullName,
      description: series.description,
      numReleases: series.numReleases,
      brand: expect.objectContaining({
        id: brand.id,
        name: brand.name,
      }),
    });
  });

  it("returns 404 for non-existent series", async function () {
    const caller = createCaller();
    const err = await waitError(caller.bottleSeriesById(999999));
    expect(err).toMatchInlineSnapshot(`[TRPCError: Series not found.]`);
  });
});
