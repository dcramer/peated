import { db } from "@peated/server/db";
import {
  bottles,
  bottleTombstones,
  entities,
  externalReviewArticles,
  externalReviews,
  externalReviewSourcePolicies,
  memberReviews,
  tastings,
} from "@peated/server/db/schema";
import { visibleExternalReviewWhere } from "@peated/server/externalReviews/visibility";
import { implement } from "@peated/server/orpc";
import statsContract from "@peated/server/orpc/contracts/stats";
import { and, eq, isNotNull, sql } from "drizzle-orm";

// This route counts only current public Bottle identities.
function activeBottleWhere() {
  return and(
    isNotNull(bottles.groupId),
    sql`NOT EXISTS(SELECT FROM ${bottleTombstones} WHERE ${bottleTombstones.bottleId} = ${bottles.id})`,
  );
}

export default implement(statsContract).handler(async function () {
  const asOf = new Date().toISOString();
  const [
    tastingTotals,
    bottleTotals,
    entityTotals,
    memberReviewTotals,
    externalReviewTotals,
  ] = await Promise.all([
    db.select({ tastings: sql<string>`COUNT(${tastings.id})` }).from(tastings),
    db
      .select({ bottles: sql<string>`COUNT(${bottles.id})` })
      .from(bottles)
      .where(activeBottleWhere()),
    db
      .select({
        brands: sql<string>`COUNT(${entities.id}) FILTER (WHERE ${entities.kind} = 'brand')`,
        distilleries: sql<string>`COUNT(${entities.id}) FILTER (WHERE ${entities.kind} = 'distillery')`,
        bottlers: sql<string>`COUNT(${entities.id}) FILTER (WHERE ${entities.kind} = 'bottler')`,
        blenders: sql<string>`COUNT(${entities.id}) FILTER (WHERE ${entities.kind} = 'blender')`,
        companies: sql<string>`COUNT(${entities.id}) FILTER (WHERE ${entities.kind} = 'company')`,
      })
      .from(entities),
    db
      .select({
        memberReviews: sql<string>`COUNT(${memberReviews.id})`,
      })
      .from(memberReviews)
      .innerJoin(bottles, eq(memberReviews.bottleId, bottles.id))
      .where(activeBottleWhere()),
    db
      .select({
        externalReviews: sql<string>`COUNT(${externalReviews.id})`,
      })
      .from(externalReviews)
      .innerJoin(
        externalReviewArticles,
        eq(externalReviews.articleId, externalReviewArticles.id),
      )
      .leftJoin(
        externalReviewSourcePolicies,
        eq(
          externalReviewArticles.externalSiteId,
          externalReviewSourcePolicies.externalSiteId,
        ),
      )
      .innerJoin(bottles, eq(externalReviews.bottleId, bottles.id))
      .where(and(activeBottleWhere(), visibleExternalReviewWhere())),
  ]);

  const tastingTotal = tastingTotals[0]!;
  const bottleTotal = bottleTotals[0]!;
  const entityTotal = entityTotals[0]!;
  const memberReviewTotal = memberReviewTotals[0]!;
  const externalReviewTotal = externalReviewTotals[0]!;

  return {
    asOf,
    bottles: Number(bottleTotal.bottles),
    brands: Number(entityTotal.brands),
    distilleries: Number(entityTotal.distilleries),
    bottlers: Number(entityTotal.bottlers),
    blenders: Number(entityTotal.blenders),
    companies: Number(entityTotal.companies),
    tastings: Number(tastingTotal.tastings),
    memberReviews: Number(memberReviewTotal.memberReviews),
    externalReviews: Number(externalReviewTotal.externalReviews),
  };
});
