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
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("creates a new entity", async ({ defaults }) => {
    const data = await routerClient.entities.create(
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

  test("updates existing entity with new type", async ({
    fixtures,
    defaults,
  }) => {
    const entity = await fixtures.Entity({
      name: "A",
      type: ["distiller"],
    });

    const data = await routerClient.entities.create(
      {
        name: entity.name,
        type: ["brand"],
      },
      { context: { user: defaults.user } },
    );

    expect(data.id).toBeDefined();

    const [brand] = await db
      .select()
      .from(entities)
      .where(eq(entities.id, data.id));
    expect(brand.id).toEqual(entity.id);
    expect(brand.type).toEqual(["distiller", "brand"]);
    expect(workerClient.pushJob).toHaveBeenCalledWith("OnEntityChange", {
      entityId: entity.id,
    });
    expect(workerClient.pushUniqueJob).not.toHaveBeenCalledWith(
      "VerifyEntityCreation",
      expect.anything(),
      expect.anything(),
    );
  });
});
