import { db } from "@peated/server/db";
import { regions } from "@peated/server/db/schema";
import { omit } from "@peated/server/lib/filter";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { createCaller } from "../router";

test("requires authentication", async () => {
  const caller = createCaller({ user: null });
  const err = await waitError(
    caller.regionCreate({
      name: "Test Region",
      country: 1,
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});

test("requires mod", async ({ defaults }) => {
  const caller = createCaller({ user: defaults.user });
  const err = await waitError(
    caller.regionCreate({
      name: "Test Region",
      country: 1,
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});

test("creates a new region", async ({ fixtures }) => {
  const country = await fixtures.Country();
  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });

  const data = await caller.regionCreate({
    name: "Test Region",
    country: country.id,
    description: "A test region",
  });

  expect(data.id).toBeDefined();
  expect(data.name).toBe("Test Region");
  expect(data.slug).toBe("test-region");
  expect(data.description).toBe("A test region");

  const [newRegion] = await db
    .select()
    .from(regions)
    .where(eq(regions.id, data.id));

  expect(newRegion).toBeDefined();
  expect(newRegion.countryId).toBe(country.id);
});

test("throws error for non-existent country", async ({ fixtures }) => {
  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });

  const err = await waitError(
    caller.regionCreate({
      name: "Test Region",
      country: 9999, // Non-existent country ID
    }),
  );

  expect(err).toMatchInlineSnapshot(`[TRPCError: Country not found.]`);
});

test("handles duplicate name", async ({ fixtures }) => {
  const country = await fixtures.Country();
  const existingRegion = await fixtures.Region({ countryId: country.id });

  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });

  const err = await waitError(
    caller.regionCreate({
      name: existingRegion.name,
      country: country.id,
    }),
  );

  expect(err).toBeInstanceOf(Error);
  expect(err.message).toContain("Conflict");
});

test("creates region with minimal data", async ({ fixtures }) => {
  const country = await fixtures.Country();
  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });

  const data = await caller.regionCreate({
    name: "Minimal Region",
    country: country.id,
  });

  expect(data.id).toBeDefined();
  expect(data.name).toBe("Minimal Region");
  expect(data.description).toBeNull();

  const [newRegion] = await db
    .select()
    .from(regions)
    .where(eq(regions.id, data.id));

  expect(newRegion).toBeDefined();
  expect(newRegion.countryId).toBe(country.id);
});
