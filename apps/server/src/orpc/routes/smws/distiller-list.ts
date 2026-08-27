import { SMWS_DISTILLERY_CODES } from "@peated/bottle-classifier/smws";
import { db } from "@peated/server/db";
import { entities, entityAliases } from "@peated/server/db/schema";
import { implement } from "@peated/server/orpc";
import smwsDistillerListContract from "@peated/server/orpc/contracts/smws/distiller-list";
import { serialize } from "@peated/server/serializers";
import { EntitySerializer } from "@peated/server/serializers/entity";
import { sql } from "drizzle-orm";

export default implement(smwsDistillerListContract).handler(async function ({
  context,
}) {
  const results = await db
    .select()
    .from(entities)
    .where(
      sql`${entities.id} IN (
          SELECT ${entityAliases.entityId} FROM ${entityAliases}
          WHERE LOWER(${entityAliases.name}) IN ${Object.values(SMWS_DISTILLERY_CODES).map((s) => s.toLowerCase())}
        )`,
    );

  return {
    results: await serialize(EntitySerializer, results, context.user),
    rel: {
      nextCursor: null,
      prevCursor: null,
    },
  };
});
