import { db } from "@peated/server/db";
import { changes } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

describe("PATCH /bottle-series/:series", () => {
  it("requires authentication", async () => {
    const err = await waitError(
      routerClient.bottleSeries.update({
        series: 1,
      })
    );
    expect(err).toMatchInlineSnapshot("[Error: Unauthorized.]");
  });

  it("requires moderator access", async ({ defaults }) => {
    const err = await waitError(
      routerClient.bottleSeries.update(
        {
          series: 1,
        },
        { context: { user: defaults.user } }
      )
    );
    expect(err).toMatchInlineSnapshot("[Error: Unauthorized.]");
  });

  it("updates a series with new attributes", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

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

    const result = await routerClient.bottleSeries.update(data, {
      context: { user },
    });

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
          eq(changes.objectType, "bottle_series")
        )
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

  it("prevents duplicate series names within the same brand", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });

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
      routerClient.bottleSeries.update(
        {
          series: series2.id,
          name: series1.name,
        },
        { context: { user } }
      )
    );

    expect(err).toMatchInlineSnapshot(
      "[Error: A series with this name already exists.]"
    );
  });

  it("performs partial updates correctly", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    const brand = await fixtures.Entity({ name: "Ardbeg" });
    const series = await fixtures.BottleSeries({
      name: "Original Series",
      description: "The original description",
      brandId: brand.id,
    });

    // Update only the name
    const result = await routerClient.bottleSeries.update(
      {
        series: series.id,
        name: "Updated Series",
      },
      { context: { user } }
    );

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
          eq(changes.objectType, "bottle_series")
        )
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
