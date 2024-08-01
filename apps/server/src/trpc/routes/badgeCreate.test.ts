import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { badges } from "../../db/schema";
import { createCaller } from "../router";

test("requires admin", async ({ defaults }) => {
  const caller = createCaller({ user: defaults.user });
  const err = await waitError(
    caller.badgeCreate({
      name: "Single Malts",
      checks: [{ type: "category", config: { category: ["single_malt"] } }],
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});

test("creates badge", async ({ fixtures }) => {
  const caller = createCaller({
    user: await fixtures.User({ admin: true }),
  });

  const data = await caller.badgeCreate({
    name: "Single Malts",
    checks: [{ type: "category", config: { category: ["single_malt"] } }],
  });

  expect(data.id).toBeDefined();

  const [badge] = await db.select().from(badges).where(eq(badges.id, data.id));
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
