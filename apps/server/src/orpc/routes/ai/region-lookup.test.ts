import { createRouterClient } from "@orpc/server";
import waitError from "@peated/server/lib/test/waitError";
import type { Context } from "@peated/server/orpc/context";
import {
  createRegionLookupProcedure,
  type RegionDetailsGenerator,
} from "@peated/server/orpc/routes/ai/region-lookup";
import { beforeEach, describe, expect, test, vi } from "vitest";

const generateRegionDetails = vi.fn<RegionDetailsGenerator>();

function createRegionLookupClient(config: { context: Context }) {
  return createRouterClient(
    { regionLookup: createRegionLookupProcedure(generateRegionDetails) },
    config,
  );
}

describe("POST /ai/region-lookup", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    generateRegionDetails.mockResolvedValue({
      description: "This is a generated description for a region.",
    });
  });

  test("requires authentication", async () => {
    const err = await waitError(() =>
      createRegionLookupClient({ context: { user: null } }).regionLookup({
        country: 1,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("requires mod privileges", async ({ fixtures }) => {
    const user = await fixtures.User();

    const err = await waitError(() =>
      createRegionLookupClient({ context: { user } }).regionLookup({
        country: 1,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("returns error with invalid country", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });

    const err = await waitError(() =>
      createRegionLookupClient({ context: { user } }).regionLookup({
        country: 999999, // non-existent country
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Cannot find country]`);
  });

  test("generates region details", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const country = await fixtures.Country({ name: "Scotland" });

    const result = await createRegionLookupClient({
      context: { user },
    }).regionLookup({
      country: country.id,
      name: "Highlands",
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "description": "This is a generated description for a region.",
      }
    `);

    expect(generateRegionDetails).toHaveBeenCalledWith({
      country,
      name: "Highlands",
    });
  });
});
