import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import type * as catalogVerificationModule from "@peated/server/lib/catalogVerification";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import * as workerClient from "@peated/server/worker/client";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test, vi } from "vitest";

const queueEntityCreationVerificationMock = vi.hoisted(() => vi.fn());

vi.mock("@peated/server/worker/client", () => ({
  pushJob: vi.fn(),
  pushUniqueJob: vi.fn(),
}));

vi.mock("@peated/server/lib/catalogVerification", async () => {
  const actual = await vi.importActual<typeof catalogVerificationModule>(
    "@peated/server/lib/catalogVerification",
  );

  return {
    ...actual,
    queueEntityCreationVerification: queueEntityCreationVerificationMock,
  };
});

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
    expect(queueEntityCreationVerificationMock).toHaveBeenCalledWith({
      entityId: data.id,
      creationSource: "manual_entry",
    });
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
    expect(queueEntityCreationVerificationMock).not.toHaveBeenCalled();
  });
});
