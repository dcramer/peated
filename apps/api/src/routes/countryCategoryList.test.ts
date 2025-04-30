import { TRPCError } from "@trpc/server";
import { createCaller } from "../trpc/router";

test("lists categories for a country by id", async ({ fixtures, expect }) => {
  const country = await fixtures.Country();
  const distiller = await fixtures.Entity({
    countryId: country.id,
    type: ["distiller"],
  });
  const bottle1 = await fixtures.Bottle({
    category: "bourbon",
    distillerIds: [distiller.id],
  });
  const bottle2 = await fixtures.Bottle({
    category: "single_malt",
    distillerIds: [distiller.id],
  });

  const caller = createCaller({ user: null });
  const { results, totalCount } = await caller.countryCategoryList({
    country: country.id,
  });

  expect(results).toMatchInlineSnapshot(`
    [
      {
        "category": "bourbon",
        "count": 1,
      },
      {
        "category": "single_malt",
        "count": 1,
      },
    ]
  `);
  expect(totalCount).toBe(2);
});

test("lists categories for a country by slug", async ({ fixtures, expect }) => {
  const country = await fixtures.Country({ slug: "scotland" });
  const distiller = await fixtures.Entity({
    countryId: country.id,
    type: ["distiller"],
  });
  const bottle = await fixtures.Bottle({
    category: "single_malt",
    distillerIds: [distiller.id],
  });

  const caller = createCaller({ user: null });
  const { results, totalCount } = await caller.countryCategoryList({
    country: "scotland",
  });

  expect(results).toMatchInlineSnapshot(`
    [
      {
        "category": "single_malt",
        "count": 1,
      },
    ]
  `);
  expect(totalCount).toBe(1);
});

test("returns empty results for a country with no bottles", async ({
  fixtures,
  expect,
}) => {
  const country = await fixtures.Country();

  const caller = createCaller({ user: null });
  const { results, totalCount } = await caller.countryCategoryList({
    country: country.id,
  });

  expect(results).toMatchInlineSnapshot(`[]`);
  expect(totalCount).toBe(0);
});

test("aggregates counts correctly for multiple bottles in the same category", async ({
  fixtures,
  expect,
}) => {
  const country = await fixtures.Country();
  const distiller = await fixtures.Entity({
    countryId: country.id,
    type: ["distiller"],
  });
  await fixtures.Bottle({ category: "bourbon", distillerIds: [distiller.id] });
  await fixtures.Bottle({ category: "bourbon", distillerIds: [distiller.id] });
  await fixtures.Bottle({
    category: "single_malt",
    distillerIds: [distiller.id],
  });

  const caller = createCaller({ user: null });
  const { results, totalCount } = await caller.countryCategoryList({
    country: country.id,
  });

  expect(results).toMatchInlineSnapshot(`
    [
      {
        "category": "bourbon",
        "count": 2,
      },
      {
        "category": "single_malt",
        "count": 1,
      },
    ]
  `);
  expect(totalCount).toBe(3);
});

// TODO:
// test("throws error for invalid country id", async () => {
//   const caller = createCaller({ user: null });
//   await expect(caller.countryCategoryList({ country: 0 })).rejects.toThrow(TRPCError);
// });

test("throws error for invalid country slug", async () => {
  const caller = createCaller({ user: null });
  await expect(
    caller.countryCategoryList({ country: "nonexistent" }),
  ).rejects.toThrow(TRPCError);
});
