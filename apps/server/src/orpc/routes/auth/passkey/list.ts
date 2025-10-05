import { db } from "@peated/server/db";
import { passkeys } from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAuth } from "@peated/server/orpc/middleware";
import { eq } from "drizzle-orm";
import { z } from "zod";

const PasskeySchema = z.object({
  id: z.number(),
  nickname: z.string().nullable(),
  createdAt: z.date(),
  lastUsedAt: z.date().nullable(),
  transports: z.array(z.string()).nullable(),
});

export default procedure
  .use(requireAuth)
  .route({
    method: "GET",
    path: "/auth/passkey/list",
    summary: "List user's passkeys",
    description: "Get all passkeys registered for the current user",
    spec: (spec) => ({
      ...spec,
      operationId: "passkeyList",
    }),
  })
  .output(
    z.object({
      results: z.array(PasskeySchema),
    }),
  )
  .handler(async function ({ context }) {
    const user = context.user;

    const userPasskeys = await db
      .select({
        id: passkeys.id,
        nickname: passkeys.nickname,
        createdAt: passkeys.createdAt,
        lastUsedAt: passkeys.lastUsedAt,
        transports: passkeys.transports,
      })
      .from(passkeys)
      .where(eq(passkeys.userId, user.id))
      .orderBy(passkeys.createdAt);

    return { results: userPasskeys };
  });
