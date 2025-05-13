import { db } from "@peated/server/db";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { entities } from "../../db/schema";
import { routerClient } from "../router";

describe("POST /entities", () => {
  test("requires authentication", async () => {
    const err = await waitError(
      routerClient.entityCreate({
        name: "Delicious Wood",
      }),
    );
    expect(err).toMatchInlineSnapshot(`[ORPCError: UNAUTHORIZED]`);
  });

  test("creates a new entity", async ({ defaults }) => {
    const data = await routerClient.entityCreate(
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
  });

  // test("removes distillery suffix", async ({ defaults }) => {
  //   const data = await routerClient.entityCreate(
  //     {
  //       name: "Macallan Distillery",
  //     },
  //     { context: { user: defaults.user } }
  //   );

  //   expect(data.id).toBeDefined();

  //   const [brand] = await db
  //     .select()
  //     .from(entities)
  //     .where(eq(entities.id, data.id));
  //   expect(brand.name).toEqual("Macallan");
  // });

  test("updates existing entity with new type", async ({
    fixtures,
    defaults,
  }) => {
    const entity = await fixtures.Entity({
      name: "A",
      type: ["distiller"],
    });

    const data = await routerClient.entityCreate(
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
  });
});
