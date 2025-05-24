import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("PUT /badges/:badge", () => {
  test("requires admin", async ({ fixtures }) => {
    const user = await fixtures.User();
    const badge = await fixtures.Badge();
    const err = await waitError(
      routerClient.badges.update(
        {
          badge: badge.id,
          name: "Foobar",
        },
        { context: { user } },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("updates badge", async ({ fixtures }) => {
    const user = await fixtures.User({ admin: true });
    const badge = await fixtures.Badge();

    const newBadge = await routerClient.badges.update(
      {
        badge: badge.id,
        name: "Foobar",
      },
      { context: { user } },
    );

    expect(newBadge).toBeDefined();
    expect(newBadge.name).toEqual("Foobar");
  });

  test("validates config for category", async ({ fixtures }) => {
    const user = await fixtures.User({ admin: true });
    const badge = await fixtures.Badge({
      checks: [{ type: "category", config: { category: ["bourbon"] } }],
    });

    const newBadge = await routerClient.badges.update(
      {
        badge: badge.id,
        name: "Single Malts",
        checks: [{ type: "category", config: { category: ["single_malt"] } }],
      },
      { context: { user } },
    );

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
});
