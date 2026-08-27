import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import * as workerClient from "@peated/server/lib/test/workerDispatch";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("POST /entities", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("requires authentication", async () => {
    const err = await waitError(
      routerClient.entities.create({
        name: "Delicious Wood",
        kind: "brand",
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("creates a new entity", async ({ defaults }) => {
    const data = await routerClient.entities.create(
      {
        name: "Macallan",
        kind: "brand",
      },
      { context: { user: defaults.user } },
    );

    expect(data.id).toBeDefined();

    const [brand] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, data.id));
    expect(brand).toMatchObject({ name: "Macallan", kind: "brand" });
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

  test("creates an entity with a current owner", async ({
    fixtures,
    defaults,
  }) => {
    const owner = await fixtures.Entity({ kind: "company" });

    const data = await routerClient.entities.create(
      {
        name: "Lagavulin",
        kind: "distillery",
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

  test("accepts every entity kind", async ({ defaults }) => {
    const created = await Promise.all(
      (["brand", "distillery", "bottler", "blender", "company"] as const).map(
        (kind) =>
          routerClient.entities.create(
            { name: `Generic ${kind}`, kind },
            { context: { user: defaults.user } },
          ),
      ),
    );

    expect(created.map((entity) => entity.kind)).toEqual([
      "brand",
      "distillery",
      "bottler",
      "blender",
      "company",
    ]);
  });

  test("rejects an unknown current owner", async ({ defaults }) => {
    const err = await waitError(
      routerClient.entities.create(
        {
          name: "Lagavulin",
          kind: "distillery",
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

    const data = await routerClient.entities.create(
      {
        name: entity.name,
        kind: "distillery",
      },
      { context: { user: defaults.user } },
    );

    expect(data.id).toEqual(entity.id);
    expect(data.kind).toEqual("distillery");
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

    const data = await routerClient.entities.create(
      { name: "macallan", kind: "brand" },
      { context: { user: defaults.user } },
    );

    expect(data.id).toBe(entity.id);
    expect(data.name).toBe(entity.name);
    expect(workerClient.pushJob).not.toHaveBeenCalled();
  });

  test("rejects an existing entity under another kind", async ({
    fixtures,
    defaults,
  }) => {
    await fixtures.Entity({ name: "Compass Box", kind: "blender" });

    const err = await waitError(
      routerClient.entities.create(
        { name: "Compass Box", kind: "brand" },
        { context: { user: defaults.user } },
      ),
    );

    expect(err.message).toBe(
      "Entity with name already exists under another kind.",
    );
  });
});
