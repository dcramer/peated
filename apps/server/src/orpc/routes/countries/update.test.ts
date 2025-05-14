import { db } from "@peated/server/db";
import { countries } from "@peated/server/db/schema";
import { omit } from "@peated/server/lib/filter";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("PATCH /countries/:slug", () => {
  describe("authentication and authorization", () => {
    test("requires authentication", async () => {
      const err = await waitError(
        routerClient.countries.update({
          slug: "test-country",
        }),
      );
      expect(err).toMatchInlineSnapshot(`[ORPCError: UNAUTHORIZED]`);
    });

    test("requires mod", async ({ defaults }) => {
      const err = await waitError(
        routerClient.countries.update(
          {
            slug: "test-country",
          },
          { context: { user: defaults.user } },
        ),
      );
      expect(err).toMatchInlineSnapshot(`[Error: Unauthorized]`);
    });
  });

  describe("country updates", () => {
    test("no changes", async ({ fixtures }) => {
      const country = await fixtures.Country();
      const modUser = await fixtures.User({ mod: true });

      const data = await routerClient.countries.update(
        {
          slug: country.slug,
        },
        { context: { user: modUser } },
      );

      expect(data.id).toBeDefined();

      const [newCountry] = await db
        .select()
        .from(countries)
        .where(eq(countries.id, data.id));

      expect(country).toEqual(newCountry);
    });

    test("can change description", async ({ fixtures }) => {
      const country = await fixtures.Country();
      const modUser = await fixtures.User({ mod: true });

      const data = await routerClient.countries.update(
        {
          slug: country.slug,
          description: "New description",
        },
        { context: { user: modUser } },
      );

      expect(data.id).toBeDefined();

      const [newCountry] = await db
        .select()
        .from(countries)
        .where(eq(countries.id, data.id));

      expect(
        omit(country, "description", "descriptionSrc", "updatedAt"),
      ).toEqual(omit(newCountry, "description", "descriptionSrc", "updatedAt"));
      expect(newCountry.description).toBe("New description");
      expect(newCountry.descriptionSrc).toBe("user");
    });

    test("can change summary", async ({ fixtures }) => {
      const country = await fixtures.Country();
      const modUser = await fixtures.User({ mod: true });

      const data = await routerClient.countries.update(
        {
          slug: country.slug,
          summary: "New summary",
        },
        { context: { user: modUser } },
      );

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
      const modUser = await fixtures.User({ mod: true });

      const err = await waitError(
        routerClient.countries.update(
          {
            slug: "nonexistent-country",
            description: "New description",
          },
          { context: { user: modUser } },
        ),
      );
      expect(err).toMatchInlineSnapshot(`[Error: Unauthorized]`);
    });
  });
});
