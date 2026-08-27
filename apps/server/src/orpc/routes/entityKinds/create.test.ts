import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import * as workerClient from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("dedicated Entity kind create routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("requires authentication", async () => {
    const err = await waitError(
      routerClient.brands.create({
        name: "Delicious Wood",
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("creates a new entity", async ({ defaults }) => {
    const data = await routerClient.brands.create(
      {
        name: "Macallan",
      },
      { context: { user: defaults.user } },
    );

    expect(data.id).toBeDefined();

    const [brand] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, data.id));
    expect(brand.name).toEqual("Macallan");
    expect(workerClient.pushJob).toHaveBeenCalledWith("OnEntityChange", {
      entityId: data.id,
    });
    expect(workerClient.pushUniqueJob).toHaveBeenCalledWith(
      "VerifyEntityCreation",
      {
        entityId: data.id,
        creationSource: "manual_entry",
      },
      { delay: 5000 },
    );
  });

  test("creates an entity with a kind and current owner", async ({
    fixtures,
    defaults,
  }) => {
    const owner = await fixtures.Entity({ kind: "company" });

    const data = await routerClient.distilleries.create(
      {
        name: "Lagavulin",
        ownerId: owner.id,
      },
      { context: { user: defaults.user } },
    );

    expect(data).toMatchObject({
      kind: "distillery",
      ownerId: owner.id,
    });
    expect(
      await db.query.entities.findFirst({ where: eq(entities.id, data.id) }),
    ).toMatchObject({
      kind: "distillery",
      ownerId: owner.id,
    });
  });

  test("fixes the kind for Bottler, Blender, and Company creates", async ({
    defaults,
  }) => {
    const [bottler, blender, company] = await Promise.all([
      routerClient.bottlers.create(
        { name: "Dedicated Bottler" },
        { context: { user: defaults.user } },
      ),
      routerClient.blenders.create(
        { name: "Dedicated Blender" },
        { context: { user: defaults.user } },
      ),
      routerClient.companies.create(
        { name: "Dedicated Company" },
        { context: { user: defaults.user } },
      ),
    ]);

    expect([bottler.kind, blender.kind, company.kind]).toEqual([
      "bottler",
      "blender",
      "company",
    ]);
  });

  test("rejects an unknown current owner", async ({ defaults }) => {
    const err = await waitError(
      routerClient.distilleries.create(
        {
          name: "Lagavulin",
          ownerId: 999999,
        },
        { context: { user: defaults.user } },
      ),
    );

    expect(err.message).toBe("Owner not found.");
  });

  test("returns an existing entity with the same kind", async ({
    fixtures,
    defaults,
  }) => {
    const entity = await fixtures.Entity({
      name: "A",
      kind: "distillery",
    });

    const data = await routerClient.distilleries.create(
      {
        name: entity.name,
      },
      { context: { user: defaults.user } },
    );

    expect(data.id).toBeDefined();

    const [brand] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, data.id));
    expect(brand.id).toEqual(entity.id);
    expect(brand.kind).toEqual("distillery");
    expect(workerClient.pushJob).not.toHaveBeenCalled();
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalledWith(
      "VerifyEntityCreation",
      expect.anything(),
      expect.anything(),
    );
  });

  test("returns an existing entity when the name case differs", async ({
    fixtures,
    defaults,
  }) => {
    const entity = await fixtures.Entity({
      name: "Macallan",
      kind: "brand",
    });

    const data = await routerClient.brands.create(
      { name: "macallan" },
      { context: { user: defaults.user } },
    );

    expect(data.id).toBe(entity.id);
    expect(data.name).toBe(entity.name);
    expect(workerClient.pushJob).not.toHaveBeenCalled();
  });
});
