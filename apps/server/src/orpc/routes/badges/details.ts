import { db } from "@peated/server/db";
import { badges } from "@peated/server/db/schema";
import { implement } from "@peated/server/orpc";
import badgeDetailsContract from "@peated/server/orpc/contracts/badges/details";
import { serialize } from "@peated/server/serializers";
import { BadgeSerializer } from "@peated/server/serializers/badge";
import { eq } from "drizzle-orm";

export default implement(badgeDetailsContract).handler(async function ({
  input,
  context,
  errors,
}) {
  const [badge] = await db
    .select()
    .from(badges)
    .where(eq(badges.id, input.badge));
  if (!badge) {
    throw errors.NOT_FOUND({
      message: "Badge not found.",
    });
  }
  return await serialize(BadgeSerializer, badge, context.user);
});
