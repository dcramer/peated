import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";

describe("PUT /badges/:id", () => {
  test("requires admin", async ({ fixtures }) => {
    const badge = await fixtures.Badge();
    const err = await waitError(
      routerClient.badges.update({
        id: badge.id,
        name: "Foobar",
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("updates badge", async ({ fixtures }) => {
    const badge = await fixtures.Badge();

    const newBadge = await routerClient.badges.update({
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

    const newBadge = await routerClient.badges.update({
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
});
