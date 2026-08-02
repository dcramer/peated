import config, { resolveBottleCheckFeatureFlags } from "./config";

const reviewOnlyFlags = {
  BOTTLE_CHECK_SHADOW_GENERATION: true,
  BOTTLE_CHECK_MODERATOR_VISIBILITY: true,
  BOTTLE_CHECK_EXECUTION: false,
};

describe("Bottle check feature flags", () => {
  test("default to review-only in public server config", () => {
    expect(config).toMatchObject(reviewOnlyFlags);
    expect(resolveBottleCheckFeatureFlags({})).toEqual(reviewOnlyFlags);
  });

  test("treats empty values as unset", () => {
    expect(
      resolveBottleCheckFeatureFlags({
        BOTTLE_CHECK_SHADOW_GENERATION: "",
        BOTTLE_CHECK_MODERATOR_VISIBILITY: "",
        BOTTLE_CHECK_EXECUTION: "",
      }),
    ).toEqual(reviewOnlyFlags);
  });

  test.each([
    ["BOTTLE_CHECK_SHADOW_GENERATION", "0", false],
    ["BOTTLE_CHECK_MODERATOR_VISIBILITY", "false", false],
    ["BOTTLE_CHECK_EXECUTION", "1", true],
  ] as const)("%s can override its default", (name, value, expected) => {
    expect(resolveBottleCheckFeatureFlags({ [name]: value })).toEqual({
      ...reviewOnlyFlags,
      [name]: expected,
    });
  });

  test.each([
    "BOTTLE_CHECK_SHADOW_GENERATION",
    "BOTTLE_CHECK_MODERATOR_VISIBILITY",
    "BOTTLE_CHECK_EXECUTION",
  ] as const)("%s rejects invalid values", (name) => {
    expect(() => resolveBottleCheckFeatureFlags({ [name]: "enabled" })).toThrow(
      `${name} must be one of: 1, true, 0, false`,
    );
  });
});
