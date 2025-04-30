import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "../db";
import { bottleSeries, changes } from "../db/schema";
import waitError from "../lib/test/waitError";
import { createCaller } from "../trpc/router";

describe("bottleSeriesUpdate", () => {
  it("requires authentication", async () => {
    const caller = createCaller({ user: null });
    const err = await waitError(
      caller.bottleSeriesUpdate({
        series: 1,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
  });

  it("requires moderator access", async ({ defaults }) => {
    const caller = createCaller({ user: defaults.user });
    const err = await waitError(
      caller.bottleSeriesUpdate({
        series: 1,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
  });

  it("updates a series with new attributes", async function ({ fixtures }) {
    const caller = createCaller({
      user: await fixtures.User({ mod: true }),
    });

    const brand = await fixtures.Entity({ name: "Ardbeg" });
    const series = await fixtures.BottleSeries({
      name: "Original Series",
      description: "The original series of releases",
      brandId: brand.id,
    });

    const data = {
      series: series.id,
      name: "Updated Series",
      description: "The updated series description",
    };

    const result = await caller.bottleSeriesUpdate(data);

    expect(result).toMatchObject({
      id: series.id,
      name: data.name,
      description: data.description,
      brand: expect.objectContaining({
        id: brand.id,
        name: brand.name,
      }),
    });

    // Verify changes were recorded
    const [change] = await db
      .select()
      .from(changes)
      .where(
        and(
          eq(changes.objectId, series.id),
          eq(changes.objectType, "bottle_series"),
        ),
      );

    expect(change).toBeDefined();
    expect(change?.type).toBe("update");
    expect(change?.displayName).toBe(`${brand.name} ${data.name}`);
    expect(change?.data).toEqual({
      name: "Updated Series",
      description: "The updated series description",
      fullName: `${brand.name} Updated Series`,
    });
  });

  it("prevents duplicate series names within the same brand", async function ({
    fixtures,
  }) {
    const caller = createCaller({
      user: await fixtures.User({ mod: true }),
    });

    const brand = await fixtures.Entity({ name: "Ardbeg" });
    const series1 = await fixtures.BottleSeries({
      name: "Series One",
      brandId: brand.id,
    });
    const series2 = await fixtures.BottleSeries({
      name: "Series Two",
      brandId: brand.id,
    });

    const err = await waitError(
      caller.bottleSeriesUpdate({
        series: series2.id,
        name: series1.name,
      }),
    );

    expect(err.message).toBe("A series with this name already exists.");
  });

  it("performs partial updates correctly", async function ({ fixtures }) {
    const caller = createCaller({
      user: await fixtures.User({ mod: true }),
    });

    const brand = await fixtures.Entity({ name: "Ardbeg" });
    const series = await fixtures.BottleSeries({
      name: "Original Series",
      description: "The original description",
      brandId: brand.id,
    });

    // Update only the name
    const result = await caller.bottleSeriesUpdate({
      series: series.id,
      name: "Updated Series",
    });

    expect(result).toMatchObject({
      id: series.id,
      name: "Updated Series",
      description: "The original description", // Description should remain unchanged
      brand: expect.objectContaining({
        id: brand.id,
        name: brand.name,
      }),
    });

    // Verify changes were recorded
    const [change] = await db
      .select()
      .from(changes)
      .where(
        and(
          eq(changes.objectId, series.id),
          eq(changes.objectType, "bottle_series"),
        ),
      );

    expect(change).toBeDefined();
    expect(change?.type).toBe("update");
    expect(change?.displayName).toBe(`${brand.name} Updated Series`);
    expect(change?.data).toEqual({
      name: "Updated Series",
      fullName: `${brand.name} Updated Series`,
    });
  });
});
