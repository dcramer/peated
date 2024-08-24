import { db } from "@peated/server/db";
import { countries } from "@peated/server/db/schema";
import { omit } from "@peated/server/lib/filter";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { createCaller } from "../router";

describe("authentication and authorization", () => {
  test("requires authentication", async () => {
    const caller = createCaller({ user: null });
    const err = await waitError(
      caller.countryUpdate({
        slug: "test-country",
      }),
    );
    expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
  });

  test("requires mod", async ({ defaults }) => {
    const caller = createCaller({ user: defaults.user });
    const err = await waitError(
      caller.countryUpdate({
        slug: "test-country",
      }),
    );
    expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
  });
});

describe("country updates", () => {
  test("no changes", async ({ fixtures }) => {
    const country = await fixtures.Country();

    const caller = createCaller({
      user: await fixtures.User({ mod: true }),
    });
    const data = await caller.countryUpdate({
      slug: country.slug,
    });

    expect(data.id).toBeDefined();

    const [newCountry] = await db
      .select()
      .from(countries)
      .where(eq(countries.id, data.id));

    expect(country).toEqual(newCountry);
  });

  test("can change description", async ({ fixtures }) => {
    const country = await fixtures.Country();

    const caller = createCaller({
      user: await fixtures.User({ mod: true }),
    });
    const data = await caller.countryUpdate({
      slug: country.slug,
      description: "New description",
    });

    expect(data.id).toBeDefined();

    const [newCountry] = await db
      .select()
      .from(countries)
      .where(eq(countries.id, data.id));

    expect(omit(country, "description", "descriptionSrc", "updatedAt")).toEqual(
      omit(newCountry, "description", "descriptionSrc", "updatedAt"),
    );
    expect(newCountry.description).toBe("New description");
    expect(newCountry.descriptionSrc).toBe("user");
  });

  test("can change summary", async ({ fixtures }) => {
    const country = await fixtures.Country();

    const caller = createCaller({
      user: await fixtures.User({ mod: true }),
    });
    const data = await caller.countryUpdate({
      slug: country.slug,
      summary: "New summary",
    });

    expect(data.id).toBeDefined();

    const [newCountry] = await db
      .select()
      .from(countries)
      .where(eq(countries.id, data.id));

    expect(omit(country, "summary", "updatedAt")).toEqual(
      omit(newCountry, "summary", "updatedAt"),
    );
    expect(newCountry.summary).toBe("New summary");
  });

  test("throws error for invalid country slug", async ({ fixtures }) => {
    const caller = createCaller({
      user: await fixtures.User({ mod: true }),
    });
    const err = await waitError(
      caller.countryUpdate({
        slug: "nonexistent-country",
        description: "New description",
      }),
    );
    expect(err).toMatchInlineSnapshot(`[TRPCError: NOT_FOUND]`);
  });
});
