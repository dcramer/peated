import { db } from "@peated/server/db";
import { tastings, toasts } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { createCaller } from "../router";

test("requires auth", async () => {
  const caller = createCaller({
    user: null,
  });
  const err = await waitError(caller.toastCreate(1));
  expect(err).toMatchInlineSnapshot();
});

test("cannot toast self", async ({ defaults, fixtures }) => {
  const tasting = await fixtures.Tasting({
    createdById: defaults.user.id,
  });

  const caller = createCaller({
    user: defaults.user,
  });
  const err = await waitError(caller.toastCreate(tasting.id));
  expect(err).toMatchInlineSnapshot();
});

test("new toast", async ({ defaults, fixtures }) => {
  const tasting = await fixtures.Tasting();

  const caller = createCaller({
    user: defaults.user,
  });
  await caller.toastCreate(tasting.id);

  const toastList = await db
    .select()
    .from(toasts)
    .where(eq(toasts.tastingId, tasting.id));

  expect(toastList.length).toBe(1);
  expect(toastList[0].createdById).toBe(defaults.user.id);

  const [updatedTasting] = await db
    .select()
    .from(tastings)
    .where(eq(tastings.id, tasting.id));
  expect(updatedTasting.toasts).toBe(1);
});

test("already toasted", async ({ defaults, fixtures }) => {
  const tasting = await fixtures.Tasting({ toasts: 1 });
  await fixtures.Toast({
    tastingId: tasting.id,
    createdById: defaults.user.id,
  });

  const caller = createCaller({
    user: defaults.user,
  });
  await caller.toastCreate(tasting.id);

  const toastList = await db
    .select()
    .from(toasts)
    .where(eq(toasts.tastingId, tasting.id));

  expect(toastList.length).toBe(1);
  expect(toastList[0].createdById).toBe(defaults.user.id);

  const [updatedTasting] = await db
    .select()
    .from(tastings)
    .where(eq(tastings.id, tasting.id));
  expect(updatedTasting.toasts).toBe(1);
});
