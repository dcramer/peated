import {
  BadgeCheckInputSchema,
  BadgeCheckSchema,
  BadgeSchema,
} from "@peated/server/schemas";
import { createTastingForBadge } from "../testHelpers";
import {
  EveryTastingCheck,
  EveryTastingCheckConfigSchema,
} from "./everyTastingCheck";

describe("config schema", () => {
  test("valid params", async () => {
    const config = {};
    expect(
      await EveryTastingCheckConfigSchema.parseAsync(config),
    ).toMatchInlineSnapshot(`{}`);
  });

  test("preserves arbitrary stored config", async () => {
    const config = { legacy: { value: true } };

    const badge = BadgeSchema.parse({
      id: 1,
      name: "Any tasting",
      checks: [{ type: "everyTasting", config }],
    });

    expect(badge.checks?.[0]?.config).toEqual(config);
  });

  test("preserves arbitrary input config and defaults missing config", () => {
    const config = ["legacy", { value: true }];

    expect(
      BadgeCheckInputSchema.parse({ type: "everyTasting", config }).config,
    ).toEqual(config);
    expect(BadgeCheckSchema.parse({ type: "everyTasting" }).config).toEqual({});
    expect(
      BadgeCheckInputSchema.parse({ type: "everyTasting" }).config,
    ).toEqual({});
  });
});

describe("test", () => {
  test("matches a bottle", async ({ fixtures }) => {
    const tasting = await createTastingForBadge(fixtures);

    const badgeImpl = new EveryTastingCheck();
    expect(badgeImpl.test(tasting)).toEqual(true);
  });
});
