import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { badges } from "../../db/schema";
import { routerClient } from "../router";

describe("POST /badges", () => {
  test("requires admin", async ({ defaults }) => {
    const err = await waitError(
      routerClient.badgeCreate({
        name: "Single Malts",
        tracker: "bottle",
        formula: "default",
        checks: [{ type: "category", config: { category: ["single_malt"] } }],
      }),
    );
    expect(err).toMatchInlineSnapshot();
  });

  test("creates badge", async ({ fixtures }) => {
    const data = await routerClient.badgeCreate({
      name: "Single Malts",
      tracker: "bottle",
      formula: "default",
      checks: [{ type: "category", config: { category: ["single_malt"] } }],
    });

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
