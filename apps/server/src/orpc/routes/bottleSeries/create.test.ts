import { db } from "@peated/server/db";
import { bottleSeries, changes } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

describe("POST /bottle-series", () => {
  it("creates a new series", async function ({ fixtures, defaults }) {
    const brand = await fixtures.Entity({ name: "Ardbeg" });

    const data = {
      name: "Supernova",
      description: "A series of heavily peated whiskies",
      brand: brand.id,
    };

    const result = await routerClient.bottleSeries.create(data, {
      context: { user: defaults.user },
    });

    // Verify key properties of the response
    expect(result).toMatchObject({
      name: data.name,
      description: data.description,
      brand: {
        id: brand.id,
        name: brand.name,
      },
      numReleases: 0,
    });

    // Verify the series was created in the database
    const dbSeries = await db.query.bottleSeries.findFirst({
      where: eq(bottleSeries.id, result.id),
    });
    expect(dbSeries).toMatchObject({
      name: data.name,
      description: data.description,
      brandId: brand.id,
      numReleases: 0,
    });

    // Verify change record was created
    const change = await db.query.changes.findFirst({
      where: and(
        eq(changes.objectId, result.id),
        eq(changes.objectType, "bottle_series"),
      ),
    });
    expect(change).toMatchObject({
      objectId: result.id,
      objectType: "bottle_series",
      type: "add",
      displayName: `${brand.name} ${data.name}`,
      data: {
        name: data.name,
        fullName: `${brand.name} ${data.name}`,
        description: data.description,
        brandId: brand.id,
      },
      createdById: defaults.user.id,
    });
  });

  it("requires authentication", async function ({ fixtures }) {
    const brand = await fixtures.Entity({ name: "Ardbeg" });

    const data = {
      name: "Supernova",
      description: "A series of heavily peated whiskies",
      brand: brand.id,
    };

    const error = await waitError(() => routerClient.bottleSeries.create(data));

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  it("validates brand exists", async function ({ fixtures, defaults }) {
    const data = {
      name: "Supernova",
      description: "A series of heavily peated whiskies",
      brand: 12345,
    };

    const error = await waitError(() =>
      routerClient.bottleSeries.create(data, {
        context: { user: defaults.user },
      }),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Brand not found.]`);
  });
});
