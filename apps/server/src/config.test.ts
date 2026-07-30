import config, { resolveBottleCheckFeatureFlags } from "./config";

const disabledFlags = {
  BOTTLE_CHECK_SHADOW_GENERATION: false,
  BOTTLE_CHECK_MODERATOR_VISIBILITY: false,
  BOTTLE_CHECK_EXECUTION: false,
};

describe("Bottle check feature flags", () => {
  test("are disabled by default in public server config", () => {
    expect(config).toMatchObject(disabledFlags);
    expect(resolveBottleCheckFeatureFlags({})).toEqual(disabledFlags);
  });

  test.each([
    "BOTTLE_CHECK_SHADOW_GENERATION",
    "BOTTLE_CHECK_MODERATOR_VISIBILITY",
    "BOTTLE_CHECK_EXECUTION",
  ] as const)("%s can be enabled independently", (name) => {
    expect(resolveBottleCheckFeatureFlags({ [name]: "1" })).toEqual({
      ...disabledFlags,
      [name]: true,
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
