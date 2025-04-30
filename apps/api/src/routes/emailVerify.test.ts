import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { signPayload } from "@peated/server/lib/auth";
import { eq } from "drizzle-orm";
import { createCaller } from "../trpc/router";

test("valid token", async ({ fixtures }) => {
  const caller = createCaller();

  const user = await fixtures.User({ verified: false });

  const token = await signPayload({
    id: user.id,
    email: user.email,
  });

  await caller.emailVerify(token);

  const [newUser] = await db.select().from(users).where(eq(users.id, user.id));
  expect(newUser.verified).toEqual(true);
});
