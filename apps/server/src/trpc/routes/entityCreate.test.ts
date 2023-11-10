import { db } from "@peated/server/db";
import { eq } from "drizzle-orm";
import { entities } from "../../db/schema";
import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("requires authentication", async () => {
  const caller = appRouter.createCaller({ user: null });
  expect(() =>
    caller.entityCreate({
      name: "Delicious Wood",
    }),
  ).rejects.toThrowError(/UNAUTHORIZED/);
});

test("creates a new entity", async () => {
  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  const data = await caller.entityCreate({
    name: "Macallan",
  });

  expect(data.id).toBeDefined();

  const [brand] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, data.id));
  expect(brand.name).toEqual("Macallan");
});

test("updates existing entity with new type", async () => {
  const entity = await Fixtures.Entity({
    type: ["distiller"],
  });

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  const data = await caller.entityCreate({
    name: entity.name,
    type: ["brand"],
  });

  expect(data.id).toBeDefined();

  const [brand] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, data.id));
  expect(brand.id).toEqual(entity.id);
  expect(brand.type).toEqual(["distiller", "brand"]);
});
