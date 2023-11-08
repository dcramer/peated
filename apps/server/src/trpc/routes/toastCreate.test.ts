import { db } from "@peated/server/db";
import { tastings, toasts } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("requires auth", async () => {
  const caller = appRouter.createCaller({
    user: null,
  });
  expect(() => caller.toastCreate(1)).rejects.toThrowError(/UNAUTHORIZED/);
});

test("cannot toast self", async () => {
  const tasting = await Fixtures.Tasting({
    createdById: DefaultFixtures.user.id,
  });

  const caller = appRouter.createCaller({
    user: DefaultFixtures.user,
  });
  expect(() => caller.toastCreate(tasting.id)).rejects.toThrowError(
    /Cannot toast your own tasting/,
  );
});

test("new toast", async () => {
  const tasting = await Fixtures.Tasting();

  const caller = appRouter.createCaller({
    user: DefaultFixtures.user,
  });
  await caller.toastCreate(tasting.id);

  const toastList = await db
    .select()
    .from(toasts)
    .where(eq(toasts.tastingId, tasting.id));

  expect(toastList.length).toBe(1);
  expect(toastList[0].createdById).toBe(DefaultFixtures.user.id);

  const [updatedTasting] = await db
    .select()
    .from(tastings)
    .where(eq(tastings.id, tasting.id));
  expect(updatedTasting.toasts).toBe(1);
});

test("already toasted", async () => {
  const tasting = await Fixtures.Tasting({ toasts: 1 });
  await Fixtures.Toast({
    tastingId: tasting.id,
    createdById: DefaultFixtures.user.id,
  });

  const caller = appRouter.createCaller({
    user: DefaultFixtures.user,
  });
  await caller.toastCreate(tasting.id);

  const toastList = await db
    .select()
    .from(toasts)
    .where(eq(toasts.tastingId, tasting.id));

  expect(toastList.length).toBe(1);
  expect(toastList[0].createdById).toBe(DefaultFixtures.user.id);

  const [updatedTasting] = await db
    .select()
    .from(tastings)
    .where(eq(tastings.id, tasting.id));
  expect(updatedTasting.toasts).toBe(1);
});
