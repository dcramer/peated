import { db } from "@peated/server/db";
import { createCaller } from "../router";

test("requires authentication", async () => {
  const caller = createCaller({ user: null });
  expect(() =>
    caller.tastingImageDelete({
      tasting: 1,
    }),
  ).rejects.toThrowError(/UNAUTHORIZED/);
});

test("cannot delete another user's image", async ({ fixtures }) => {
  const user = await fixtures.User();
  const otherUser = await fixtures.User();
  const tasting = await fixtures.Tasting({ createdById: otherUser.id });

  const caller = createCaller({ user });
  expect(() =>
    caller.tastingImageDelete({
      tasting: tasting.id,
    }),
  ).rejects.toThrowError(/Cannot delete another user's tasting image/);
});

test("deletes existing image", async ({ defaults, fixtures }) => {
  const tasting = await fixtures.Tasting({
    createdById: defaults.user.id,
    imageUrl: "http://example.com/image.png",
  });

  const caller = createCaller({ user: defaults.user });
  const data = await caller.tastingImageDelete({
    tasting: tasting.id,
  });

  expect(data.imageUrl).toBe(null);

  const newTasting = await db.query.tastings.findFirst({
    where: (tastings, { eq }) => eq(tastings.id, tasting.id),
  });

  expect(newTasting?.imageUrl).toBe(null);
});
