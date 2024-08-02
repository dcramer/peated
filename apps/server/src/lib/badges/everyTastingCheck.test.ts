import { EveryTastingCheck } from "./everyTastingCheck";
import { createTastingForBadge } from "./testHelpers";

describe("parseConfig", () => {
  test("valid params", async () => {
    const badgeImpl = new EveryTastingCheck();
    const config = {};
    expect(await badgeImpl.parseConfig(config)).toMatchInlineSnapshot(`{}`);
  });
});

describe("track", () => {
  test("tracks bottle", async ({ fixtures }) => {
    const tasting = await createTastingForBadge(fixtures);

    const badgeImpl = new EveryTastingCheck();
    const config = {};
    expect(badgeImpl.track(config, tasting)).toMatchInlineSnapshot(`
      []
    `);
  });
});

describe("test", () => {
  test("matches a bottle", async ({ fixtures }) => {
    const tasting = await createTastingForBadge(fixtures);

    const badgeImpl = new EveryTastingCheck();
    const config = {};
    expect(badgeImpl.test(config, tasting)).toEqual(true);
  });
});
