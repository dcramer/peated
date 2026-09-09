import { db } from "@peated/server/db";
import type {
  ExternalReview,
  MemberReview,
  Tasting,
} from "@peated/server/db/schema";
import {
  bottles,
  bottleTombstones,
  entities,
  externalReviewArticles,
  externalReviewPublications,
  externalReviews,
  memberReviews,
  tastings,
  users,
} from "@peated/server/db/schema";
import { visibleExternalReviewWhere } from "@peated/server/externalReviews/visibility";
import { viewerVisibleUserCondition } from "@peated/server/lib/activityVisibility";
import { bottleIdsForEntity } from "@peated/server/lib/entityBottleIds";
import {
  ActiveBottleSelectionError,
  resolveActiveBottleIds,
} from "@peated/server/lib/resolveActiveBottleIds";
import { implement } from "@peated/server/orpc";
import contract from "@peated/server/orpc/contracts/activity/reviews-and-tastings";
import { serialize } from "@peated/server/serializers";
import { BottleSerializer } from "@peated/server/serializers/bottle";
import { ExternalReviewSerializer } from "@peated/server/serializers/externalReview";
import { MemberReviewSerializer } from "@peated/server/serializers/memberReview";
import { TastingSerializer } from "@peated/server/serializers/tasting";
import { eq, inArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

const Cursor = z.object({
  snapshotAt: z.string().datetime(),
  occurredAt: z.string().datetime(),
  kindRank: z.number().int().min(1).max(3),
  id: z.number().int().positive(),
});
type Cursor = z.infer<typeof Cursor>;

function encodeCursor(cursor: Cursor) {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function parseCursor(value?: string): Cursor | null {
  if (!value) return null;
  try {
    return Cursor.parse(JSON.parse(Buffer.from(value, "base64url").toString()));
  } catch {
    return null;
  }
}

type Row = {
  type: "tasting" | "member_review" | "critic_review";
  kindRank: number | string;
  id: number | string;
  bottleId: number | string;
  occurredAt: Date | string;
};

export default implement(contract).handler(
  async ({ input, context, errors }) => {
    const parsedCursor = parseCursor(input.cursor);
    if (input.cursor && !parsedCursor) {
      throw errors.BAD_REQUEST({
        message: "That reviews-and-tastings page is invalid.",
      });
    }
    const requestedBottleId = input.bottle;
    if (requestedBottleId) {
      try {
        await db.transaction((tx) =>
          resolveActiveBottleIds(tx, [requestedBottleId]),
        );
      } catch (error) {
        if (error instanceof ActiveBottleSelectionError) {
          if (error.reason === "missing") {
            throw errors.NOT_FOUND({ message: error.message, cause: error });
          }
          throw errors.CONFLICT({ message: error.message, cause: error });
        }
        throw error;
      }
    } else {
      const [entity] = await db
        .select({ id: entities.id })
        .from(entities)
        .where(eq(entities.id, input.entity!))
        .limit(1);
      if (!entity) {
        throw errors.NOT_FOUND({ message: "Brand or producer not found." });
      }
    }

    const snapshotAt = parsedCursor
      ? new Date(parsedCursor.snapshotAt)
      : new Date();
    const userCondition = viewerVisibleUserCondition(context.user?.id);
    const scopeCte = input.entity
      ? sql`
          WITH scoped_bottles AS MATERIALIZED (
            SELECT ${bottles.id} AS bottle_id
            FROM ${bottles}
            WHERE ${bottles.id} IN (${bottleIdsForEntity(input.entity)})
              AND ${bottles.groupId} IS NOT NULL
              AND NOT EXISTS (
                SELECT FROM ${bottleTombstones}
                WHERE ${bottleTombstones.bottleId} = ${bottles.id}
              )
          )
        `
      : sql``;
    const scope = (bottleId: SQL<unknown>) =>
      input.bottle
        ? sql`${bottleId} = ${input.bottle}`
        : sql`${bottleId} IN (SELECT bottle_id FROM scoped_bottles)`;
    const after = parsedCursor
      ? sql`AND (
        activity.occurred_at < ${new Date(parsedCursor.occurredAt)}
        OR (
          activity.occurred_at = ${new Date(parsedCursor.occurredAt)}
          AND activity.kind_rank < ${parsedCursor.kindRank}
        )
        OR (
          activity.occurred_at = ${new Date(parsedCursor.occurredAt)}
          AND activity.kind_rank = ${parsedCursor.kindRank}
          AND activity.id < ${parsedCursor.id}
        )
      )`
      : sql``;

    const result = await db.execute<Row>(sql`
    ${scopeCte}
    SELECT activity.type, activity.kind_rank AS "kindRank", activity.id,
      activity.bottle_id AS "bottleId",
      activity.occurred_at AS "occurredAt"
    FROM (
      SELECT 'tasting'::text AS type, 3 AS kind_rank, ${tastings.id} AS id,
        ${tastings.bottleId} AS bottle_id, ${tastings.createdAt} AS occurred_at
      FROM ${tastings}
      INNER JOIN ${users} ON ${users.id} = ${tastings.createdById}
      WHERE ${userCondition}
        AND ${scope(sql`${tastings.bottleId}`)}
        AND ${tastings.removedAt} IS NULL
        AND ${tastings.createdAt} <= ${snapshotAt}

      UNION ALL

      SELECT 'member_review'::text AS type, 2 AS kind_rank,
        ${memberReviews.id} AS id, ${memberReviews.bottleId} AS bottle_id,
        ${memberReviews.createdAt} AS occurred_at
      FROM ${memberReviews}
      INNER JOIN ${users} ON ${users.id} = ${memberReviews.createdById}
      WHERE ${userCondition}
        AND ${scope(sql`${memberReviews.bottleId}`)}
        AND ${memberReviews.removedAt} IS NULL
        AND ${memberReviews.createdAt} <= ${snapshotAt}

      UNION ALL

      SELECT 'critic_review'::text AS type, 1 AS kind_rank,
        ${externalReviews.id} AS id, ${externalReviews.bottleId} AS bottle_id,
        COALESCE(${externalReviewArticles.publishedAt}, ${externalReviews.createdAt})
          AS occurred_at
      FROM ${externalReviews}
      INNER JOIN ${externalReviewArticles}
        ON ${externalReviewArticles.id} = ${externalReviews.articleId}
      LEFT JOIN ${externalReviewPublications}
        ON ${externalReviewPublications.externalSiteId} =
          ${externalReviewArticles.externalSiteId}
      WHERE ${visibleExternalReviewWhere()}
        AND ${scope(sql`${externalReviews.bottleId}`)}
        AND COALESCE(${externalReviewArticles.publishedAt}, ${externalReviews.createdAt})
          <= ${snapshotAt}
    ) activity
    WHERE TRUE ${after}
    ORDER BY activity.occurred_at DESC, activity.kind_rank DESC, activity.id DESC
    LIMIT ${input.limit + 1}
  `);
    const page = result.rows.slice(0, input.limit);
    const tastingIds = page
      .filter((row) => row.type === "tasting")
      .map((row) => Number(row.id));
    const memberReviewIds = page
      .filter((row) => row.type === "member_review")
      .map((row) => Number(row.id));
    const criticReviewIds = page
      .filter((row) => row.type === "critic_review")
      .map((row) => Number(row.id));
    const noTastings: Tasting[] = [];
    const noMemberReviews: MemberReview[] = [];
    const noCriticReviews: ExternalReview[] = [];

    const [tastingRows, memberRows, criticRows] = await Promise.all([
      tastingIds.length
        ? db.select().from(tastings).where(inArray(tastings.id, tastingIds))
        : Promise.resolve(noTastings),
      memberReviewIds.length
        ? db
            .select()
            .from(memberReviews)
            .where(inArray(memberReviews.id, memberReviewIds))
        : Promise.resolve(noMemberReviews),
      criticReviewIds.length
        ? db
            .select()
            .from(externalReviews)
            .where(inArray(externalReviews.id, criticReviewIds))
        : Promise.resolve(noCriticReviews),
    ]);
    const memberBottleIds = [
      ...new Set(memberRows.map((review) => review.bottleId)),
    ];
    const memberBottleRows = memberBottleIds.length
      ? await db
          .select()
          .from(bottles)
          .where(inArray(bottles.id, memberBottleIds))
      : [];
    const [
      serializedTastings,
      serializedMemberReviews,
      serializedMemberBottles,
      serializedCriticReviews,
    ] = await Promise.all([
      serialize(TastingSerializer, tastingRows, context.user),
      serialize(MemberReviewSerializer, memberRows, context.user),
      serialize(BottleSerializer, memberBottleRows, context.user, [], {
        includeGroupSummary: true,
      }),
      serialize(ExternalReviewSerializer, criticRows, context.user),
    ]);
    const tastingById = new Map(
      serializedTastings.map((item) => [item.id, item]),
    );
    const memberBottleById = new Map(
      serializedMemberBottles.map((item) => [item.id, item]),
    );
    const memberById = new Map(
      serializedMemberReviews.map((item) => [
        item.id,
        { ...item, bottle: memberBottleById.get(item.bottleId)! },
      ]),
    );
    const criticById = new Map(
      serializedCriticReviews.map((item) => [item.id, item]),
    );
    const last = page.at(-1);

    return {
      results: page.map((row) => {
        const id = Number(row.id);
        if (row.type === "tasting")
          return { type: row.type, tasting: tastingById.get(id)! };
        if (row.type === "member_review")
          return { type: row.type, review: memberById.get(id)! };
        return { type: row.type, review: criticById.get(id)! };
      }),
      rel: {
        nextCursor:
          result.rows.length > input.limit && last
            ? encodeCursor({
                snapshotAt: snapshotAt.toISOString(),
                occurredAt: new Date(last.occurredAt).toISOString(),
                kindRank: Number(last.kindRank),
                id: Number(last.id),
              })
            : null,
      },
    };
  },
);
