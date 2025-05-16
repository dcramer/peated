import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("POST /bottles/validations", () => {
  test("requires authentication", async () => {
    const err = await waitError(() =>
      routerClient.bottles.validation({
        name: "Test Bottle",
        brand: { name: "Test Brand" },
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("returns normalized data", async ({ fixtures }) => {
    const user = await fixtures.User();
    const brand = await fixtures.Entity({ type: ["brand"] });

    const data = await routerClient.bottles.validation(
      {
        name: "Test 12-year-old",
        brand: brand.id,
        statedAge: 12,
      },
      { context: { user } },
    );

    expect(data).toMatchObject({
      name: "Test 12-year-old",
      statedAge: 12,
      vintageYear: null,
      releaseYear: null,
    });
  });

  test("normalizes SMWS bottle", async ({ fixtures }) => {
    const user = await fixtures.User();
    const brand = await fixtures.Entity({
      type: ["brand"],
      name: "The Scotch Malt Whisky Society",
    });
    const distillery = await fixtures.Entity({
      type: ["distiller"],
      name: "Ardbeg",
    });

    const data = await routerClient.bottles.validation(
      {
        name: "33.141 Tarry ropes on a smokehouse roof",
        brand: brand.id,
      },
      { context: { user } },
    );

    expect(data).toMatchObject({
      name: "Tarry ropes on a smokehouse roof",
    });
  });

  test("strips brand prefix from name", async ({ fixtures }) => {
    const user = await fixtures.User();
    const brand = await fixtures.Entity({
      type: ["brand"],
      name: "Macallan",
    });

    const data = await routerClient.bottles.validation(
      {
        name: "Macallan 12",
        brand: brand.id,
      },
      { context: { user } },
    );

    expect(data).toMatchObject({
      name: "12",
    });
  });
});
