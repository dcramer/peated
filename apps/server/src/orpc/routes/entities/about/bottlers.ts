import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { countBottlers } from "@peated/server/lib/entityAbout/catalogNumbers";
import { implement } from "@peated/server/orpc";
import entityAboutBottlersContract from "@peated/server/orpc/contracts/entities/about/bottlers";
import { eq } from "drizzle-orm";

export default implement(entityAboutBottlersContract).handler(async function ({
  input,
  errors,
}) {
  const [entity] = await db
    .select({ id: entities.id })
    .from(entities)
    .where(eq(entities.id, input.entity))
    .limit(1);
  if (!entity) throw errors.NOT_FOUND({ message: "Entity not found." });

  return await countBottlers(entity.id);
});
