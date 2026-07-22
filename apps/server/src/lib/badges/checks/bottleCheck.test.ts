import waitError from "../../test/waitError";
import { createTastingForBadge, useGenericBadgeTarget } from "../testHelpers";
import { BottleCheck, BottleCheckConfigSchema } from "./bottleCheck";

describe("config schema", () => {
  test("valid params", async () => {
    const config = {
      bottle: [1],
    };
    expect(await BottleCheckConfigSchema.parseAsync(config))
      .toMatchInlineSnapshot(`
      {
        "bottle": [
          1,
        ],
      }
    `);
  });

  test("no bottleId", async () => {
    const config = {
      bottle: [],
    };
    const err = await waitError(BottleCheckConfigSchema.parseAsync(config));
    expect(err).toMatchInlineSnapshot(`
      [ZodError: [
        {
          "origin": "array",
          "code": "too_small",
          "minimum": 1,
          "inclusive": true,
          "path": [
            "bottle"
          ],
          "message": "At least one bottle is required."
        }
      ]]
    `);
  });
});

describe("test", () => {
  test("matches bottle", async ({ fixtures }) => {
    const tasting = await createTastingForBadge(fixtures, { statedAge: 5 });
    if (tasting.identity.kind !== "bottle") {
      throw new Error("Expected an exact Bottle fixture");
    }

    const badgeImpl = new BottleCheck();
    const config = {
      bottle: [tasting.identity.bottleId],
    };
    expect(badgeImpl.test(config, tasting)).toEqual(true);
  });

  test("doesnt match bottle", async ({ fixtures }) => {
    const tasting = await createTastingForBadge(fixtures, { statedAge: 10 });
    if (tasting.identity.kind !== "bottle") {
      throw new Error("Expected an exact Bottle fixture");
    }

    const badgeImpl = new BottleCheck();
    const config = {
      bottle: [tasting.identity.bottleId + 1],
    };
    expect(badgeImpl.test(config, tasting)).toEqual(false);
  });

  test("does not substitute a bottle for a generic target", async ({
    fixtures,
  }) => {
    const exact = await createTastingForBadge(fixtures);
    const tasting = await useGenericBadgeTarget(exact.id);
    const badgeImpl = new BottleCheck();
    if (exact.identity.kind !== "bottle") {
      throw new Error("Expected an exact Bottle fixture");
    }

    expect(tasting.identity.kind).toBe("group");
    expect(badgeImpl.test({ bottle: [exact.identity.bottleId] }, tasting)).toBe(
      false,
    );
  });
});
