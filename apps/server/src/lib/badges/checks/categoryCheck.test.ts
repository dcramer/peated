import type { z } from "zod";
import waitError from "../../test/waitError";
import { createTastingForBadge } from "../testHelpers";
import { CategoryCheck, CategoryCheckConfigSchema } from "./categoryCheck";

describe("config schema", () => {
  test("valid params", async () => {
    const config = {
      category: ["single_malt"],
    };
    expect(await CategoryCheckConfigSchema.parseAsync(config))
      .toMatchInlineSnapshot(`
      {
        "category": [
          "single_malt",
        ],
      }
    `);
  });

  test("no category", async () => {
    const config = {
      category: [],
    };
    const err = await waitError(CategoryCheckConfigSchema.parseAsync(config));
    expect(err).toMatchInlineSnapshot(`
      [ZodError: [
        {
          "origin": "array",
          "code": "too_small",
          "minimum": 1,
          "inclusive": true,
          "path": [
            "category"
          ],
          "message": "At least one category is required."
        }
      ]]
    `);
  });

  test("invalid category", async () => {
    const config = {
      category: ["foo"],
    };
    const err = await waitError(CategoryCheckConfigSchema.parseAsync(config));
    expect(err).toMatchInlineSnapshot(`
      [ZodError: [
        {
          "code": "invalid_value",
          "values": [
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
          "message": "Invalid option: expected one of \\"blend\\"|\\"bourbon\\"|\\"rye\\"|\\"single_grain\\"|\\"single_malt\\"|\\"single_pot_still\\"|\\"spirit\\""
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
    } satisfies z.infer<typeof CategoryCheckConfigSchema>;
    expect(badgeImpl.test(config, tasting)).toEqual(true);
  });

  test("doesnt match bottle", async ({ fixtures }) => {
    const tasting = await createTastingForBadge(fixtures, {
      category: "single_malt",
    });

    const badgeImpl = new CategoryCheck();
    const config = {
      category: ["bourbon"],
    } satisfies z.infer<typeof CategoryCheckConfigSchema>;
    expect(badgeImpl.test(config, tasting)).toEqual(false);
  });
});
