import { db } from "@peated/server/db";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { entities } from "../../db/schema";
import { createCaller } from "../router";

test("requires authentication", async () => {
  const caller = createCaller({ user: null });
  const err = await waitError(
    caller.entityCreate({
      name: "Delicious Wood",
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});

test("creates a new entity", async ({ defaults }) => {
  const caller = createCaller({ user: defaults.user });
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

test("removes distillery suffix", async ({ defaults }) => {
  const caller = createCaller({ user: defaults.user });
  const data = await caller.entityCreate({
    name: "Macallan Distillery",
  });

  expect(data.id).toBeDefined();

  const [brand] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, data.id));
  expect(brand.name).toEqual("Macallan");
});

test("updates existing entity with new type", async ({
  fixtures,
  defaults,
}) => {
  const entity = await fixtures.Entity({
    name: "A",
    type: ["distiller"],
  });

  const caller = createCaller({ user: defaults.user });
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

test("creates a new entity with parent", async ({ fixtures }) => {
  const parentEntity = await fixtures.Entity();
  const caller = createCaller({ user: await fixtures.User({ mod: true }) });

  const data = await caller.entityCreate({
    name: "Child Entity",
    parent: parentEntity.id,
  });

  expect(data.id).toBeDefined();
  expect(data.parent).toBeDefined();
  expect(data.parent?.id).toEqual(parentEntity.id);
  expect(data.parent?.name).toEqual(parentEntity.name);

  const [childEntity] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, data.id));

  expect(childEntity.parentId).toEqual(parentEntity.id);
});
