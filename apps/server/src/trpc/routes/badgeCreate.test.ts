import { eq } from "drizzle-orm";
import { db } from "../../db";
import { badges } from "../../db/schema";
import { appRouter } from "../router";

test("requires admin", async () => {
  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  expect(() =>
    caller.badgeCreate({
      type: "category",
      name: "Single Malts",
      config: { category: ["single_malt"] },
    }),
  ).rejects.toThrowError(/UNAUTHORIZED/);
});

test("validates config for category", async () => {
  const caller = appRouter.createCaller({ user: DefaultFixtures.user });

  expect(() =>
    caller.badgeCreate({
      type: "category",
      name: "Single Malts",
      config: { bottle: [1] },
    }),
  ).rejects.toThrowError(/BAD_REQUEST/);
});

test("creates badge", async () => {
  const caller = appRouter.createCaller({ user: DefaultFixtures.user });

  const data = await caller.badgeCreate({
    type: "category",
    name: "Single Malts",
    config: { category: ["single_malt"] },
  });

  expect(data.id).toBeDefined();

  const [badge] = await db.select().from(badges).where(eq(badges.id, data.id));
  expect(badge.name).toEqual("Single Malts");
  expect(badge.type).toEqual("category");
  expect(badge.config).toEqual({ category: ["single_malt"] });
});
