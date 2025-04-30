import type { z } from "zod";
import waitError from "../../test/waitError";
import { createTastingForBadge } from "../testHelpers";
import { CategoryCheck } from "./categoryCheck";

describe("parseConfig", () => {
  test("valid params", async () => {
    const badgeImpl = new CategoryCheck();
    const config = {
      category: ["single_malt"],
    };
    expect(await badgeImpl.parseConfig(config)).toMatchInlineSnapshot(`
      {
        "category": [
          "single_malt",
        ],
      }
    `);
  });

  test("no category", async () => {
    const badgeImpl = new CategoryCheck();
    const config = {
      category: [],
    };
    const err = await waitError(badgeImpl.parseConfig(config));
    expect(err).toMatchInlineSnapshot(`
      [ZodError: [
        {
          "code": "too_small",
          "minimum": 1,
          "type": "array",
          "inclusive": true,
          "exact": false,
          "message": "At least one category is required.",
          "path": [
            "category"
          ]
        }
      ]]
    `);
  });

  test("invalid category", async () => {
    const badgeImpl = new CategoryCheck();
    const config = {
      category: ["foo"],
    };
    const err = await waitError(badgeImpl.parseConfig(config));
    expect(err).toMatchInlineSnapshot(`
      [ZodError: [
        {
          "received": "foo",
          "code": "invalid_enum_value",
          "options": [
            "blend",
            "bourbon",
            "rye",
            "single_grain",
            "single_malt",
            "single_pot_still",
            "spirit"
          ],
          "path": [
            "category",
            0
          ],
          "message": "Invalid enum value. Expected 'blend' | 'bourbon' | 'rye' | 'single_grain' | 'single_malt' | 'single_pot_still' | 'spirit', received 'foo'"
        }
      ]]
    `);
  });
});

describe("test", () => {
  test("matches bottle", async ({ fixtures }) => {
    const tasting = await createTastingForBadge(fixtures, {
      category: "single_malt",
    });

    const badgeImpl = new CategoryCheck();
    const config = {
      category: ["single_malt"],
    } satisfies z.infer<(typeof badgeImpl)["schema"]>;
    expect(badgeImpl.test(config, tasting)).toEqual(true);
  });

  test("doesnt match bottle", async ({ fixtures }) => {
    const tasting = await createTastingForBadge(fixtures, {
      category: "single_malt",
    });

    const badgeImpl = new CategoryCheck();
    const config = {
      category: ["bourbon"],
    } satisfies z.infer<(typeof badgeImpl)["schema"]>;
    expect(badgeImpl.test(config, tasting)).toEqual(false);
  });
});
