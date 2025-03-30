import type { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "../../db";
import { bottleSeries, changes } from "../../db/schema";
import waitError from "../../lib/test/waitError";
import { createCaller } from "../router";

describe("bottleSeriesCreate", () => {
  it("creates a new series", async function ({ fixtures, defaults }) {
    const caller = createCaller({ user: defaults.user });

    const brand = await fixtures.Entity({ name: "Ardbeg" });

    const data = {
      name: "Supernova",
      description: "A series of heavily peated whiskies",
      brand: brand.id,
    };

    const result = await caller.bottleSeriesCreate(data);

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
    const caller = createCaller({ user: null });

    const brand = await fixtures.Entity({ name: "Ardbeg" });

    const data = {
      name: "Supernova",
      description: "A series of heavily peated whiskies",
      brand: brand.id,
    };

    const error = await waitError<TRPCError>(async () =>
      caller.bottleSeriesCreate(data),
    );

    expect(error.code).toBe("UNAUTHORIZED");
  });

  it("validates brand exists", async function ({ fixtures, defaults }) {
    const caller = createCaller({ user: defaults.user });

    const data = {
      name: "Supernova",
      description: "A series of heavily peated whiskies",
      brand: 12345,
    };

    const error = await waitError<TRPCError>(async () =>
      caller.bottleSeriesCreate(data),
    );

    expect(error.code).toBe("NOT_FOUND");
  });
});
