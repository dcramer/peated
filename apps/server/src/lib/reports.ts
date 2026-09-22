import { and, count, eq, inArray, isNull, or } from "drizzle-orm";
import type { AnyDatabase } from "../db";
import {
  comments,
  memberReviews,
  reports,
  tastings,
  users,
  type ReportObjectType,
} from "../db/schema";

export interface ReportTarget {
  /** The member responsible for the reported content. */
  reportedUserId: number;
  /** Path on the web app where the reported content lives. */
  contentPath: string;
  /** A short preview of the reported content. */
  contentPreview: string;
}

export interface ReportTargetKey {
  objectType: ReportObjectType;
  objectId: number;
}

const PREVIEW_LENGTH = 200;

function preview(text: string | null, fallback: string): string {
  const trimmed = text?.trim();
  if (!trimmed) return fallback;
  return trimmed.length > PREVIEW_LENGTH
    ? `${trimmed.slice(0, PREVIEW_LENGTH - 1)}…`
    : trimmed;
}

export function reportTargetKey({ objectType, objectId }: ReportTargetKey) {
  return `${objectType}:${objectId}`;
}

/** The Inbox and History title for a report, such as "Comment by @name". */
export function describeReportSubject(
  objectType: ReportObjectType,
  username: string,
): string {
  switch (objectType) {
    case "tasting":
      return `Tasting by @${username}`;
    case "member_review":
      return `Review by @${username}`;
    case "comment":
      return `Comment by @${username}`;
    case "user":
      return `Member @${username}`;
  }
}

/**
 * Load what reports point at, one query per object type. Targets that are
 * gone or already removed are left out, so reports only ever describe live
 * content.
 */
export async function loadReportTargets(
  db: AnyDatabase,
  keys: ReportTargetKey[],
): Promise<Map<string, ReportTarget>> {
  const targets = new Map<string, ReportTarget>();
  const idsOf = (objectType: ReportObjectType) => [
    ...new Set(
      keys
        .filter((key) => key.objectType === objectType)
        .map((key) => key.objectId),
    ),
  ];

  const tastingIds = idsOf("tasting");
  if (tastingIds.length) {
    const rows = await db
      .select({
        id: tastings.id,
        createdById: tastings.createdById,
        notes: tastings.notes,
      })
      .from(tastings)
      .where(and(inArray(tastings.id, tastingIds), isNull(tastings.removedAt)));
    for (const row of rows) {
      targets.set(`tasting:${row.id}`, {
        reportedUserId: row.createdById,
        contentPath: `/tastings/${row.id}`,
        contentPreview: preview(row.notes, "Tasting without notes"),
      });
    }
  }

  const reviewIds = idsOf("member_review");
  if (reviewIds.length) {
    const rows = await db
      .select({
        id: memberReviews.id,
        createdById: memberReviews.createdById,
        notes: memberReviews.notes,
      })
      .from(memberReviews)
      .where(
        and(
          inArray(memberReviews.id, reviewIds),
          isNull(memberReviews.removedAt),
        ),
      );
    for (const row of rows) {
      targets.set(`member_review:${row.id}`, {
        reportedUserId: row.createdById,
        contentPath: `/reviews/${row.id}`,
        contentPreview: preview(row.notes, "Review without notes"),
      });
    }
  }

  const commentIds = idsOf("comment");
  if (commentIds.length) {
    const rows = await db
      .select({
        id: comments.id,
        createdById: comments.createdById,
        comment: comments.comment,
        tastingId: comments.tastingId,
      })
      .from(comments)
      .innerJoin(tastings, eq(tastings.id, comments.tastingId))
      .where(and(inArray(comments.id, commentIds), isNull(tastings.removedAt)));
    for (const row of rows) {
      targets.set(`comment:${row.id}`, {
        reportedUserId: row.createdById,
        contentPath: `/tastings/${row.tastingId}`,
        contentPreview: preview(row.comment, "Empty comment"),
      });
    }
  }

  const userIds = idsOf("user");
  if (userIds.length) {
    const rows = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(and(inArray(users.id, userIds), isNull(users.deletedAt)));
    for (const row of rows) {
      targets.set(`user:${row.id}`, {
        reportedUserId: row.id,
        contentPath: `/users/${row.username}`,
        contentPreview: `@${row.username}`,
      });
    }
  }

  return targets;
}

export async function loadReportTarget(
  db: AnyDatabase,
  objectType: ReportObjectType,
  objectId: number,
): Promise<ReportTarget | null> {
  const key = { objectType, objectId };
  const targets = await loadReportTargets(db, [key]);
  return targets.get(reportTargetKey(key)) ?? null;
}

/** Count open reports per target, keyed by `reportTargetKey`. */
export async function countOpenReportsByTarget(
  db: AnyDatabase,
  keys: ReportTargetKey[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const uniqueKeys = [
    ...new Map(keys.map((key) => [reportTargetKey(key), key])).values(),
  ];
  if (!uniqueKeys.length) return counts;
  const rows = await db
    .select({
      objectType: reports.objectType,
      objectId: reports.objectId,
      count: count(),
    })
    .from(reports)
    .where(
      and(
        eq(reports.status, "open"),
        or(
          ...uniqueKeys.map((key) =>
            and(
              eq(reports.objectType, key.objectType),
              eq(reports.objectId, key.objectId),
            ),
          ),
        ),
      ),
    )
    .groupBy(reports.objectType, reports.objectId);
  for (const row of rows) {
    counts.set(reportTargetKey(row), row.count);
  }
  return counts;
}
