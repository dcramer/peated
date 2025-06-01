import { db } from "@peated/server/db";
import { badges } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("POST /badges", () => {
  test("requires admin", async ({ defaults }) => {
    const user = defaults.user;
    const err = await waitError(
      routerClient.badges.create(
        {
          name: "Single Malts",
          tracker: "bottle",
          formula: "default",
          checks: [{ type: "category", config: { category: ["single_malt"] } }],
        },
        { context: { user } }
      )
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("creates badge", async ({ fixtures }) => {
    const user = await fixtures.User({ admin: true });
    const data = await routerClient.badges.create(
      {
        name: "Single Malts",
        tracker: "bottle",
        formula: "default",
        checks: [{ type: "category", config: { category: ["single_malt"] } }],
      },
      { context: { user } }
    );

    expect(data.id).toBeDefined();

    const [badge] = await db
      .select()
      .from(badges)
      .where(eq(badges.id, data.id));
    expect(badge.name).toEqual("Single Malts");
    expect(badge.checks).toMatchInlineSnapshot(`
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
