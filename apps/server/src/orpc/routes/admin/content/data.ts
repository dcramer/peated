import config from "@peated/server/config";
import { db } from "@peated/server/db";
import {
  actors,
  bottles,
  changes,
  externalReviewArticles,
  externalReviewPublications,
  externalReviews,
  externalSites,
  memberReviews,
  tastings,
  users,
} from "@peated/server/db/schema";
import type { ChangeData } from "@peated/server/db/schema/changes";
import { absoluteUrl } from "@peated/server/lib/urls";
import {
  AdminContentItemSchema,
  type AdminContentItem,
  type AdminContentKind,
  type AdminContentListItem,
  type AdminContentStatus,
} from "@peated/server/schemas";
import {
  and,
  desc,
  eq,
  ilike,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { z } from "zod";

type ListInput = {
  cursor: number;
  id?: number;
  kind: AdminContentKind;
  limit: number;
  query: string;
  status: AdminContentStatus;
};

function statusWhere(column: AnyPgColumn, status: AdminContentStatus) {
  if (status === "active") return isNull(column);
  if (status === "removed") return isNotNull(column);
  return undefined;
}

function moderationFromRow(row: {
  removedAt: Date | null;
  removedByActorId: number | null;
  removalReason: string | null;
  removedByDisplayName: string | null;
}) {
  return {
    removed: row.removedAt !== null,
    removedAt: row.removedAt?.toISOString() ?? null,
    removedBy:
      row.removedByActorId && row.removedByDisplayName
        ? {
            id: row.removedByActorId,
            displayName: row.removedByDisplayName,
          }
        : null,
    reason: row.removalReason,
  };
}

function imageUrl(value: string | null) {
  return value ? absoluteUrl(config.API_SERVER, value) : null;
}

function numericIdWhere(column: AnyPgColumn, query: string) {
  return /^\d+$/.test(query) ? eq(column, Number(query)) : undefined;
}

export async function listAdminContent(
  input: ListInput,
): Promise<{ results: AdminContentListItem[]; hasNext: boolean }> {
  const offset = (input.cursor - 1) * input.limit;
  const query = input.query.trim();

  if (input.kind === "member_review") {
    const queryWhere = input.id
      ? eq(memberReviews.id, input.id)
      : query
        ? or(
            numericIdWhere(memberReviews.id, query),
            ilike(users.username, `%${query}%`),
            ilike(bottles.fullName, `%${query}%`),
          )
        : undefined;
    const rows = await db
      .select({
        review: memberReviews,
        bottleId: bottles.id,
        bottleFullName: bottles.fullName,
        memberId: users.id,
        memberUsername: users.username,
        memberPrivate: users.private,
        removedByDisplayName: actors.displayName,
      })
      .from(memberReviews)
      .innerJoin(bottles, eq(memberReviews.bottleId, bottles.id))
      .innerJoin(users, eq(memberReviews.createdById, users.id))
      .leftJoin(actors, eq(memberReviews.removedByActorId, actors.id))
      .where(
        and(statusWhere(memberReviews.removedAt, input.status), queryWhere),
      )
      .orderBy(desc(memberReviews.updatedAt), desc(memberReviews.id))
      .limit(input.limit + 1)
      .offset(offset);
    return {
      hasNext: rows.length > input.limit,
      results: rows.slice(0, input.limit).map((row) => ({
        kind: "member_review",
        id: row.review.id,
        bottle: { id: row.bottleId, fullName: row.bottleFullName },
        member: {
          id: row.memberId,
          username: row.memberUsername,
          private: row.memberPrivate,
        },
        score: row.review.score,
        notes: row.review.notes,
        tags: row.review.tags,
        noseTags: row.review.noseTags,
        palateTags: row.review.palateTags,
        finishTags: row.review.finishTags,
        color: row.review.color,
        servingStyle: row.review.servingStyle,
        imageUrl: imageUrl(row.review.imageUrl),
        createdAt: row.review.createdAt.toISOString(),
        updatedAt: row.review.updatedAt.toISOString(),
        moderation: moderationFromRow({
          ...row.review,
          removedByDisplayName: row.removedByDisplayName,
        }),
      })),
    };
  }

  if (input.kind === "tasting") {
    const queryWhere = input.id
      ? eq(tastings.id, input.id)
      : query
        ? or(
            numericIdWhere(tastings.id, query),
            ilike(users.username, `%${query}%`),
            ilike(bottles.fullName, `%${query}%`),
          )
        : undefined;
    const rows = await db
      .select({
        tasting: tastings,
        bottleId: bottles.id,
        bottleFullName: bottles.fullName,
        memberId: users.id,
        memberUsername: users.username,
        memberPrivate: users.private,
        removedByDisplayName: actors.displayName,
      })
      .from(tastings)
      .innerJoin(bottles, eq(tastings.bottleId, bottles.id))
      .innerJoin(users, eq(tastings.createdById, users.id))
      .leftJoin(actors, eq(tastings.removedByActorId, actors.id))
      .where(and(statusWhere(tastings.removedAt, input.status), queryWhere))
      .orderBy(desc(tastings.createdAt), desc(tastings.id))
      .limit(input.limit + 1)
      .offset(offset);
    return {
      hasNext: rows.length > input.limit,
      results: rows.slice(0, input.limit).map((row) => ({
        kind: "tasting",
        id: row.tasting.id,
        bottle: { id: row.bottleId, fullName: row.bottleFullName },
        member: {
          id: row.memberId,
          username: row.memberUsername,
          private: row.memberPrivate,
        },
        ratingBand: row.tasting.ratingBand,
        notes: row.tasting.notes,
        tags: row.tasting.tags,
        color: row.tasting.color,
        servingStyle: row.tasting.servingStyle,
        imageUrl: imageUrl(row.tasting.imageUrl),
        comments: row.tasting.comments,
        toasts: row.tasting.toasts,
        createdAt: row.tasting.createdAt.toISOString(),
        moderation: moderationFromRow({
          ...row.tasting,
          removedByDisplayName: row.removedByDisplayName,
        }),
      })),
    };
  }

  const queryWhere = input.id
    ? eq(externalReviews.id, input.id)
    : query
      ? or(
          numericIdWhere(externalReviews.id, query),
          ilike(externalReviews.name, `%${query}%`),
          ilike(externalSites.name, `%${query}%`),
          ilike(externalSites.type, `%${query}%`),
          ilike(bottles.fullName, `%${query}%`),
        )
      : undefined;
  const rows = await db
    .select({
      review: externalReviews,
      article: externalReviewArticles,
      bottleId: bottles.id,
      bottleFullName: bottles.fullName,
      siteId: externalSites.id,
      siteName: externalSites.name,
      siteKey: externalSites.type,
      publicationApprovedAt: externalReviewPublications.approvedAt,
      removedByDisplayName: actors.displayName,
    })
    .from(externalReviews)
    .innerJoin(
      externalReviewArticles,
      eq(externalReviews.articleId, externalReviewArticles.id),
    )
    .innerJoin(
      externalSites,
      eq(externalReviewArticles.externalSiteId, externalSites.id),
    )
    .leftJoin(bottles, eq(externalReviews.bottleId, bottles.id))
    .leftJoin(
      externalReviewPublications,
      eq(externalSites.id, externalReviewPublications.externalSiteId),
    )
    .leftJoin(actors, eq(externalReviews.removedByActorId, actors.id))
    .where(
      and(statusWhere(externalReviews.removedAt, input.status), queryWhere),
    )
    .orderBy(desc(externalReviews.updatedAt), desc(externalReviews.id))
    .limit(input.limit + 1)
    .offset(offset);
  return {
    hasNext: rows.length > input.limit,
    results: rows.slice(0, input.limit).map((row) => ({
      kind: "external_review",
      id: row.review.id,
      name: row.review.name,
      bottle:
        row.bottleId && row.bottleFullName
          ? { id: row.bottleId, fullName: row.bottleFullName }
          : null,
      site: { id: row.siteId, name: row.siteName, key: row.siteKey },
      article: {
        title: row.article.title,
        url: row.article.canonicalUrl,
        publishedAt: row.article.publishedAt?.toISOString() ?? null,
      },
      reviewerName: row.review.reviewerName,
      nativeScoreDisplay: row.review.nativeScoreDisplay,
      clip: row.review.clip,
      tags: row.review.tags,
      hidden: row.review.hidden ?? false,
      publicationApproved: row.publicationApprovedAt !== null,
      createdAt: row.review.createdAt.toISOString(),
      updatedAt: row.review.updatedAt.toISOString(),
      moderation: moderationFromRow({
        ...row.review,
        removedByDisplayName: row.removedByDisplayName,
      }),
    })),
  };
}

const ModerationHistoryDataSchema = z.object({
  moderation: z.object({
    action: z.enum(["remove", "restore"]),
    reason: z.string(),
  }),
});

function moderationHistoryAction(value: ChangeData) {
  const parsed = ModerationHistoryDataSchema.safeParse(value);
  return parsed.success ? parsed.data.moderation : null;
}

async function loadHistory(kind: AdminContentKind, id: number) {
  const rows = await db
    .select({ change: changes, actor: actors })
    .from(changes)
    .innerJoin(actors, eq(changes.actorId, actors.id))
    .where(and(eq(changes.objectType, kind), eq(changes.objectId, id)))
    .orderBy(desc(changes.createdAt), desc(changes.id))
    .limit(20);
  return rows.flatMap(({ actor, change }) => {
    const moderation = moderationHistoryAction(change.data);
    return moderation
      ? [
          {
            id: change.id,
            ...moderation,
            createdAt: change.createdAt.toISOString(),
            actor: { id: actor.id, displayName: actor.displayName },
          },
        ]
      : [];
  });
}

export async function getAdminContent(kind: AdminContentKind, id: number) {
  const { results } = await listAdminContent({
    cursor: 1,
    id,
    kind,
    limit: 1,
    query: "",
    status: "all",
  });
  const item = results.find((candidate) => candidate.id === id);
  if (!item) return null;
  return AdminContentItemSchema.parse({
    ...item,
    history: await loadHistory(kind, id),
  });
}

export function contentTable(kind: AdminContentKind) {
  if (kind === "member_review") return memberReviews;
  if (kind === "external_review") return externalReviews;
  return tastings;
}

export function contentObjectType(kind: AdminContentKind) {
  return kind;
}

export function contentDisplayName(kind: AdminContentKind, id: number) {
  const name =
    kind === "member_review"
      ? "Member review"
      : kind === "external_review"
        ? "Critic review"
        : "Tasting";
  return `${name} ${id}`;
}
