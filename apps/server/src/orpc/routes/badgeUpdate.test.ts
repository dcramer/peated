import waitError from "@peated/server/lib/test/waitError";
import { createCaller } from "../router";

test("requires admin", async ({ fixtures }) => {
  const badge = await fixtures.Badge();
  const caller = createCaller({
    user: await fixtures.User({ mod: true }),
  });
  const err = await waitError(
    caller.badgeUpdate({
      id: badge.id,
      name: "Foobar",
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});

test("updates badge", async ({ fixtures }) => {
  const badge = await fixtures.Badge();

  const caller = createCaller({
    user: await fixtures.User({ admin: true }),
  });
  const newBadge = await caller.badgeUpdate({
    id: badge.id,
    name: "Foobar",
  });

  expect(newBadge).toBeDefined();
  expect(newBadge.name).toEqual("Foobar");
});

test("validates config for category", async ({ fixtures }) => {
  const badge = await fixtures.Badge({
    checks: [{ type: "category", config: { category: ["bourbon"] } }],
  });

  const caller = createCaller({
    user: await fixtures.User({ admin: true }),
  });

  const newBadge = await caller.badgeUpdate({
    id: badge.id,
    name: "Single Malts",
    checks: [{ type: "category", config: { category: ["single_malt"] } }],
  });

  expect(newBadge.checks).toMatchInlineSnapshot(`
    [
      {
        "config": {
          "category": [
            "single_malt",
          ],
        },
        "type": "category",
      },
    ]
  `);
});
