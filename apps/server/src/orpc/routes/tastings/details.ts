import { db } from "@peated/server/db";
import { tastings } from "@peated/server/db/schema";
import { implement } from "@peated/server/orpc";
import tastingDetailsContract from "@peated/server/orpc/contracts/tastings/details";
import { serialize } from "@peated/server/serializers";
import { TastingSerializer } from "@peated/server/serializers/tasting";
import { eq } from "drizzle-orm";

export default implement(tastingDetailsContract).handler(async function ({
  input,
  context,
  errors,
}) {
  const [tasting] = await db
    .select()
    .from(tastings)
    .where(eq(tastings.id, input.tasting));

  if (!tasting) {
    throw errors.NOT_FOUND({
      message: "Tasting not found.",
    });
  }

  return await serialize(TastingSerializer, tasting, context.user);
});
