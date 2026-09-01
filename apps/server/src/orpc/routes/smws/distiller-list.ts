import { SMWS_DISTILLERY_CODES } from "@peated/bottle-classifier/smws";
import { db } from "@peated/server/db";
import { entities, entityReferences } from "@peated/server/db/schema";
import { implement } from "@peated/server/orpc";
import smwsDistillerListContract from "@peated/server/orpc/contracts/smws/distiller-list";
import { serialize } from "@peated/server/serializers";
import { EntitySerializer } from "@peated/server/serializers/entity";
import { and, eq, inArray, sql } from "drizzle-orm";

export default implement(smwsDistillerListContract).handler(async function ({
  context,
}) {
  const codesByName = new Map<string, string[]>();
  for (const [code, name] of Object.entries(SMWS_DISTILLERY_CODES)) {
    const normalizedName = name.toLowerCase();
    codesByName.set(normalizedName, [
      ...(codesByName.get(normalizedName) ?? []),
      code,
    ]);
  }
  const distilleryNames = [...codesByName.keys()];
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

  const matchingReferences = results.length
    ? await db
        .select({
          entityId: entityReferences.entityId,
          name: entityReferences.name,
        })
        .from(entityReferences)
        .where(
          and(
            inArray(
              entityReferences.entityId,
              results.map((result) => result.id),
            ),
            sql`LOWER(${entityReferences.name}) IN ${distilleryNames}`,
          ),
        )
    : [];

  const codesByEntityId = new Map<number, Set<string>>();
  const addCodes = (entityId: number, name: string) => {
    const codes = codesByName.get(name.toLowerCase());
    if (!codes) return;

    const entityCodes = codesByEntityId.get(entityId) ?? new Set<string>();
    for (const code of codes) entityCodes.add(code);
    codesByEntityId.set(entityId, entityCodes);
  };

  for (const result of results) addCodes(result.id, result.name);
  for (const reference of matchingReferences) {
    if (reference.entityId) addCodes(reference.entityId, reference.name);
  }

  const serializedResults = await serialize(
    EntitySerializer,
    results,
    context.user,
  );

  return {
    results: serializedResults.map((result) => ({
      ...result,
      smwsCodes: [...(codesByEntityId.get(result.id) ?? [])],
    })),
    rel: {
      nextCursor: null,
      prevCursor: null,
    },
  };
});
