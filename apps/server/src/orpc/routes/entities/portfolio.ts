import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import {
  companyDescendantIds,
  getCompanyOwnershipPaths,
} from "@peated/server/lib/companyPortfolio";
import { formatPeatedId } from "@peated/server/lib/peatedId";
import { implement } from "@peated/server/orpc";
import contract from "@peated/server/orpc/contracts/entities/portfolio";
import { serialize } from "@peated/server/serializers";
import { EntitySerializer } from "@peated/server/serializers/entity";
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  inArray,
  sql,
  type SQL,
} from "drizzle-orm";

const portfolioKinds = ["brand", "distillery", "bottler"] as const;

export default implement(contract).handler(async function ({
  input,
  context,
  errors,
}) {
  const [company] = await db
    .select({ id: entities.id, kind: entities.kind })
    .from(entities)
    .where(eq(entities.id, input.company))
    .limit(1);

  if (!company) {
    throw errors.NOT_FOUND({ message: "Company not found." });
  }
  if (company.kind !== "company") {
    throw errors.BAD_REQUEST({ message: "Choose a Company." });
  }

  const requestedKinds = input.kinds ?? [...portfolioKinds];
  const descendants = sql`${entities.id} IN (${companyDescendantIds(company.id)})`;
  const portfolioWhere = and(
    descendants,
    inArray(entities.kind, requestedKinds),
  );
  const offset = (input.cursor - 1) * input.limit;

  let orderBy: SQL<unknown>;
  switch (input.sort) {
    case "name":
      orderBy = asc(entities.name);
      break;
    case "-name":
      orderBy = desc(entities.name);
      break;
    case "bottles":
      orderBy = asc(entities.totalBottles);
      break;
    case "tastings":
      orderBy = asc(entities.totalTastings);
      break;
    case "-tastings":
      orderBy = desc(entities.totalTastings);
      break;
    case "-bottles":
    default:
      orderBy = desc(entities.totalBottles);
  }

  const [
    portfolioRows,
    [totalRow],
    totalRows,
    previewRowGroups,
    groupCompanyRows,
    [groupCompanyTotalRow],
  ] = await Promise.all([
    db
      .select({ ...getTableColumns(entities) })
      .from(entities)
      .where(portfolioWhere)
      .limit(input.limit + 1)
      .offset(offset)
      .orderBy(orderBy, asc(entities.id)),
    db
      .select({ count: sql<string>`COUNT(*)` })
      .from(entities)
      .where(portfolioWhere),
    db
      .select({
        kind: entities.kind,
        count: sql<string>`COUNT(*)`,
      })
      .from(entities)
      .where(and(descendants, inArray(entities.kind, [...portfolioKinds])))
      .groupBy(entities.kind),
    Promise.all(
      portfolioKinds.map((kind) =>
        db
          .select({ ...getTableColumns(entities) })
          .from(entities)
          .where(and(descendants, eq(entities.kind, kind)))
          .limit(4)
          .orderBy(desc(entities.totalBottles), asc(entities.id)),
      ),
    ),
    db
      .select({ ...getTableColumns(entities) })
      .from(entities)
      .where(
        and(eq(entities.ownerId, company.id), eq(entities.kind, "company")),
      )
      .limit(4)
      .orderBy(desc(entities.totalBottles), asc(entities.id)),
    db
      .select({ count: sql<string>`COUNT(*)` })
      .from(entities)
      .where(
        and(eq(entities.ownerId, company.id), eq(entities.kind, "company")),
      ),
  ]);

  const shownPortfolioRows = portfolioRows.slice(0, input.limit);
  const ownershipPaths = await getCompanyOwnershipPaths(
    company.id,
    shownPortfolioRows.map(({ id }) => id),
  );
  const pathEntityIds = [
    ...new Set(
      [...ownershipPaths.values()].flatMap((path) => path.slice(0, -1)),
    ),
  ];
  const pathEntities = pathEntityIds.length
    ? await db
        .select({
          id: entities.id,
          kind: entities.kind,
          name: entities.name,
        })
        .from(entities)
        .where(inArray(entities.id, pathEntityIds))
    : [];
  const pathEntitiesById = new Map(
    pathEntities.map((entity) => [entity.id, entity]),
  );
  const serializedPortfolio = await serialize(
    EntitySerializer,
    shownPortfolioRows,
    context.user,
  );
  const counts = new Map(
    totalRows.map(({ kind, count }) => [kind, Number(count)]),
  );
  const totals = {
    brands: counts.get("brand") ?? 0,
    distilleries: counts.get("distillery") ?? 0,
    bottlers: counts.get("bottler") ?? 0,
  };
  const [brandPreviews, distilleryPreviews, bottlerPreviews] =
    await Promise.all(
      previewRowGroups.map((rows) =>
        serialize(EntitySerializer, rows, context.user),
      ),
    );

  return {
    results: serializedPortfolio.map((entity) => ({
      ...entity,
      ownershipPath: (ownershipPaths.get(entity.id) ?? [])
        .slice(0, -1)
        .flatMap((entityId) => {
          const pathEntity = pathEntitiesById.get(entityId);
          return pathEntity
            ? [
                {
                  ...pathEntity,
                  peatedId: formatPeatedId("entity", pathEntity.id),
                },
              ]
            : [];
        }),
    })),
    total: Number(totalRow?.count ?? 0),
    totals: {
      ...totals,
      all: totals.brands + totals.distilleries + totals.bottlers,
    },
    groupCompanies: {
      results: await serialize(
        EntitySerializer,
        groupCompanyRows,
        context.user,
      ),
      total: Number(groupCompanyTotalRow?.count ?? 0),
    },
    previews: {
      brands: brandPreviews ?? [],
      distilleries: distilleryPreviews ?? [],
      bottlers: bottlerPreviews ?? [],
    },
    rel: {
      nextCursor: portfolioRows.length > input.limit ? input.cursor + 1 : null,
      prevCursor: input.cursor > 1 ? input.cursor - 1 : null,
    },
  };
});
