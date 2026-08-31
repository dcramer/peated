import { SMWS_DISTILLERY_CODES } from "@peated/bottle-classifier/smws";
import { db } from "@peated/server/db";
import { entities, entityReferences } from "@peated/server/db/schema";
import { implement } from "@peated/server/orpc";
import smwsDistillerListContract from "@peated/server/orpc/contracts/smws/distiller-list";
import { serialize } from "@peated/server/serializers";
import { EntitySerializer } from "@peated/server/serializers/entity";
import { and, eq, sql } from "drizzle-orm";

export default implement(smwsDistillerListContract).handler(async function ({
  context,
}) {
  const distilleryNames = Object.values(SMWS_DISTILLERY_CODES).map((name) =>
    name.toLowerCase(),
  );
  const results = await db
    .select()
    .from(entities)
    .where(
      and(
        eq(entities.kind, "distillery"),
        sql`(LOWER(${entities.name}) IN ${distilleryNames}
          OR ${entities.id} IN (
            SELECT ${entityReferences.entityId} FROM ${entityReferences}
            WHERE LOWER(${entityReferences.name}) IN ${distilleryNames}
          ))`,
      ),
    );

  return {
    results: await serialize(EntitySerializer, results, context.user),
    rel: {
      nextCursor: null,
      prevCursor: null,
    },
  };
});
