import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import * as generateRegionDetailsModule from "@peated/server/worker/jobs/generateRegionDetails";
import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock the getGeneratedRegionDetails function
vi.mock("@peated/server/worker/jobs/generateRegionDetails", () => ({
  default: vi.fn(),
  getGeneratedRegionDetails: vi.fn(),
}));

describe("POST /ai/region-lookup", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(
      generateRegionDetailsModule.getGeneratedRegionDetails
    ).mockResolvedValue({
      description: "This is a generated description for a region.",
    });
  });

  test("requires authentication", async () => {
    const err = await waitError(() =>
      routerClient.ai.regionLookup({
        country: 1,
      })
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("requires mod privileges", async ({ fixtures }) => {
    const user = await fixtures.User();

    const err = await waitError(() =>
      routerClient.ai.regionLookup(
        {
          country: 1,
        },
        { context: { user } }
      )
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("returns error with invalid country", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    const err = await waitError(() =>
      routerClient.ai.regionLookup(
        {
          country: 999999, // non-existent country
        },
        { context: { user } }
      )
    );
    expect(err).toMatchInlineSnapshot(`[Error: Cannot find country]`);
  });

  test("generates region details", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const country = await fixtures.Country({ name: "Scotland" });

    const result = await routerClient.ai.regionLookup(
      {
        country: country.id,
        name: "Highlands",
      },
      { context: { user } }
    );

    expect(result).toMatchInlineSnapshot(`
      {
        "description": "This is a generated description for a region.",
      }
    `);

    expect(
      generateRegionDetailsModule.getGeneratedRegionDetails
    ).toHaveBeenCalledWith({
      country,
      name: "Highlands",
    });
  });
});
