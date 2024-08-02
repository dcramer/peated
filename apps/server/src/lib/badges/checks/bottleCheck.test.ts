import waitError from "../../test/waitError";
import { createTastingForBadge } from "../testHelpers";
import { BottleCheck } from "./bottleCheck";

describe("parseConfig", () => {
  test("valid params", async () => {
    const badgeImpl = new BottleCheck();
    const config = {
      bottle: [1],
    };
    expect(await badgeImpl.parseConfig(config)).toMatchInlineSnapshot(`
      {
        "bottle": [
          1,
        ],
      }
    `);
  });

  test("no bottleId", async () => {
    const badgeImpl = new BottleCheck();
    const config = {
      bottle: [],
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
          "message": "At least one bottle is required.",
          "path": [
            "bottle"
          ]
        }
      ]]
    `);
  });
});

describe("test", () => {
  test("matches bottle", async ({ fixtures }) => {
    const tasting = await createTastingForBadge(fixtures, { statedAge: 5 });

    const badgeImpl = new BottleCheck();
    const config = {
      bottle: [tasting.bottle.id],
    };
    expect(badgeImpl.test(config, tasting)).toEqual(true);
  });

  test("doesnt match bottle", async ({ fixtures }) => {
    const tasting = await createTastingForBadge(fixtures, { statedAge: 10 });

    const badgeImpl = new BottleCheck();
    const config = {
      bottle: [tasting.bottle.id + 1],
    };
    expect(badgeImpl.test(config, tasting)).toEqual(false);
  });
});
