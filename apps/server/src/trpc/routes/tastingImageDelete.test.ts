import { db } from "@peated/server/db";
import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("requires authentication", async () => {
  const caller = appRouter.createCaller({ user: null });
  expect(() =>
    caller.tastingImageDelete({
      tasting: 1,
    }),
  ).rejects.toThrowError(/UNAUTHORIZED/);
});

test("cannot delete another user's image", async () => {
  const user = await Fixtures.User();
  const otherUser = await Fixtures.User();
  const tasting = await Fixtures.Tasting({ createdById: otherUser.id });

  const caller = appRouter.createCaller({ user });
  expect(() =>
    caller.tastingImageDelete({
      tasting: tasting.id,
    }),
  ).rejects.toThrowError(/Cannot delete another user's tasting image/);
});

test("deletes existing image", async () => {
  const tasting = await Fixtures.Tasting({
    createdById: DefaultFixtures.user.id,
    imageUrl: "http://example.com/image.png",
  });

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  const data = await caller.tastingImageDelete({
    tasting: tasting.id,
  });

  expect(data.imageUrl).toBe(null);

  const newTasting = await db.query.tastings.findFirst({
    where: (tastings, { eq }) => eq(tastings.id, tasting.id),
  });

  expect(newTasting?.imageUrl).toBe(null);
});
