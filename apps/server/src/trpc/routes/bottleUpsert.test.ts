import { db } from "@peated/server/db";
import { bottles } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { createCaller } from "../router";

test("requires authentication", async () => {
  const caller = createCaller({ user: null });
  const err = await waitError(
    caller.bottleUpsert({
      expression: "Delicious Wood",
      brand: 1,
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});

test("creates a new bottle", async ({ fixtures, defaults }) => {
  const caller = createCaller({ user: await fixtures.User({ mod: true }) });
  const brand = await fixtures.Entity();
  const data = await caller.bottleUpsert({
    expression: "Delicious Wood",
    brand: brand.id,
  });

  expect(data.id).toBeDefined();

  const [bottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, data.id));
  expect(bottle.expression).toEqual("Delicious Wood");
});

test("updates existing bottle", async ({ fixtures, defaults }) => {
  const caller = createCaller({ user: await fixtures.User({ mod: true }) });
  const brand = await fixtures.Entity();
  const bottle = await fixtures.Bottle({
    brandId: brand.id,
    expression: "Delicious Wood",
  });
  const data = await caller.bottleUpsert({
    expression: "Delicious Wood",
    brand: brand.id,
    caskFill: "1st_fill",
  });

  expect(data.id).toBeDefined();
  expect(data.id).toEqual(bottle.id);

  const [newBottle] = await db
    .select()
    .from(bottles)
    .where(eq(bottles.id, data.id));
  expect(newBottle.expression).toEqual("Delicious Wood");
  expect(newBottle.caskFill).toEqual("1st_fill");
});
