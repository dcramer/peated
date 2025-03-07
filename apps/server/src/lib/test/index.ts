import { db } from "@peated/server/db";
import { users } from "@peated/server/db/schema";
import { generatePasswordHash } from "@peated/server/lib/auth";
import type { Context } from "@peated/server/trpc/context";

export async function createTestContext(): Promise<Context> {
  const [user] = await db
    .insert(users)
    .values({
      username: "testuser",
      email: "test@example.com",
      passwordHash: await generatePasswordHash("testpassword"),
      verified: true,
      private: false,
      active: true,
      admin: false,
      mod: false,
    })
    .returning();

  return {
    user,
    maxAge: 86400,
  };
}
