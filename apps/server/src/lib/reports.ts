import { and, count, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import type { AnyDatabase } from "../db";
import {
  actors,
  bottles,
  bottleSeries,
  bottleSeriesTombstones,
  bottleTombstones,
  comments,
  entities,
  entityTombstones,
  flights,
  memberReviews,
  reports,
  tastings,
  users,
  type ReportObjectType,
} from "../db/schema";

export interface ReportTarget {
  /**
   * The member responsible for the reported content. Null for a catalog
   * record created by a scraper or the system.
   */
  reportedUserId: number | null;
  /** Path on the web app where the reported content lives. */
  contentPath: string;
  /** A short preview of the reported content, or a catalog record's name. */
  contentPreview: string;
}

export interface ReportTargetKey {
  objectType: ReportObjectType;
  objectId: number;
}

/** What a report is about, from stored data plus whatever still exists. */
export interface ReportSubject extends ReportTargetKey {
  /** Username of the reported member, when the report names one. */
  reportedUsername: string | null;
  /** Current name of a reported catalog record, when it still exists. */
  recordName: string | null;
}

/** Report targets that are catalog records rather than one member's content. */
export const CATALOG_REPORT_OBJECT_TYPES: ReadonlySet<ReportObjectType> =
  new Set(["bottle", "entity", "bottle_series", "flight"]);

/** A catalog record's current name from its target preview; null otherwise. */
export function recordNameOf(
  objectType: ReportObjectType,
  contentPreview: string | null,
): string | null {
  return CATALOG_REPORT_OBJECT_TYPES.has(objectType) ? contentPreview : null;
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

function toRedirects(rows: { from: number; to: number | null }[]) {
  return new Map(
    rows.flatMap((row) => (row.to === null ? [] : [[row.from, row.to]])),
  );
}

function liveIds(ids: number[], redirects: Map<number, number>) {
  return [...new Set(ids.map((id) => redirects.get(id) ?? id))];
}

/**
 * The Inbox and History title for a report, such as "Comment by @name" or
 * "Bottle: Lagavulin 16-year-old". Falls back to the record number when the
 * content is gone.
 */
export function describeReportSubject(subject: ReportSubject): string {
  const { objectType, objectId, reportedUsername, recordName } = subject;
  const by = reportedUsername ? `by @${reportedUsername}` : `#${objectId}`;
  const named = (label: string) =>
    recordName ? `${label}: ${recordName}` : `${label} #${objectId}`;
  switch (objectType) {
    case "tasting":
      return `Tasting ${by}`;
    case "member_review":
      return `Review ${by}`;
    case "comment":
      return `Comment ${by}`;
    case "user":
      return reportedUsername
        ? `Member @${reportedUsername}`
        : `Member #${objectId}`;
    case "bottle":
      return named("Bottle");
    case "entity":
      return named("Entity");
    case "bottle_series":
      return named("Series");
    case "flight":
      return named("Flight");
  }
}

/**
 * Turn a report input's object ID into the stored numeric ID. Flights are
 * addressed by their public ID; every other target uses its numeric ID.
 * Returns null when the ID cannot name anything.
 */
export async function resolveReportObjectId(
  db: AnyDatabase,
  objectType: ReportObjectType,
  objectId: number | string,
): Promise<number | null> {
  if (objectType === "flight") {
    const [flight] = await db
      .select({ id: flights.id })
      .from(flights)
      .where(eq(flights.publicId, String(objectId)))
      .limit(1);
    return flight?.id ?? null;
  }
  const numeric = Number(objectId);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
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

  // Catalog records name the member behind the creating actor, if any. A
  // merged record follows its tombstone so the report still reaches the
  // record that lives on.
  const bottleIds = idsOf("bottle");
  if (bottleIds.length) {
    const redirects = toRedirects(
      await db
        .select({
          from: bottleTombstones.bottleId,
          to: bottleTombstones.newBottleId,
        })
        .from(bottleTombstones)
        .where(
          and(
            inArray(bottleTombstones.bottleId, bottleIds),
            isNotNull(bottleTombstones.newBottleId),
          ),
        ),
    );
    const rows = await db
      .select({
        id: bottles.id,
        fullName: bottles.fullName,
        userId: actors.userId,
      })
      .from(bottles)
      .leftJoin(actors, eq(actors.id, bottles.createdByActorId))
      .where(inArray(bottles.id, liveIds(bottleIds, redirects)));
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const id of bottleIds) {
      const row = byId.get(redirects.get(id) ?? id);
      if (!row) continue;
      targets.set(`bottle:${id}`, {
        reportedUserId: row.userId,
        contentPath: `/bottles/${row.id}`,
        contentPreview: preview(row.fullName, `Bottle #${row.id}`),
      });
    }
  }

  const entityIds = idsOf("entity");
  if (entityIds.length) {
    const redirects = toRedirects(
      await db
        .select({
          from: entityTombstones.entityId,
          to: entityTombstones.newEntityId,
        })
        .from(entityTombstones)
        .where(
          and(
            inArray(entityTombstones.entityId, entityIds),
            isNotNull(entityTombstones.newEntityId),
          ),
        ),
    );
    const rows = await db
      .select({ id: entities.id, name: entities.name, userId: actors.userId })
      .from(entities)
      .leftJoin(actors, eq(actors.id, entities.createdByActorId))
      .where(inArray(entities.id, liveIds(entityIds, redirects)));
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const id of entityIds) {
      const row = byId.get(redirects.get(id) ?? id);
      if (!row) continue;
      targets.set(`entity:${id}`, {
        reportedUserId: row.userId,
        contentPath: `/entities/${row.id}`,
        contentPreview: preview(row.name, `Entity #${row.id}`),
      });
    }
  }

  const seriesIds = idsOf("bottle_series");
  if (seriesIds.length) {
    const redirects = toRedirects(
      await db
        .select({
          from: bottleSeriesTombstones.seriesId,
          to: bottleSeriesTombstones.newSeriesId,
        })
        .from(bottleSeriesTombstones)
        .where(
          and(
            inArray(bottleSeriesTombstones.seriesId, seriesIds),
            isNotNull(bottleSeriesTombstones.newSeriesId),
          ),
        ),
    );
    const rows = await db
      .select({
        id: bottleSeries.id,
        fullName: bottleSeries.fullName,
        userId: actors.userId,
      })
      .from(bottleSeries)
      .leftJoin(actors, eq(actors.id, bottleSeries.createdByActorId))
      .where(inArray(bottleSeries.id, liveIds(seriesIds, redirects)));
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const id of seriesIds) {
      const row = byId.get(redirects.get(id) ?? id);
      if (!row) continue;
      targets.set(`bottle_series:${id}`, {
        reportedUserId: row.userId,
        contentPath: `/series/${row.id}`,
        contentPreview: preview(row.fullName, `Series #${row.id}`),
      });
    }
  }

  const flightIds = idsOf("flight");
  if (flightIds.length) {
    const rows = await db
      .select({
        id: flights.id,
        publicId: flights.publicId,
        name: flights.name,
        createdById: flights.createdById,
      })
      .from(flights)
      .where(inArray(flights.id, flightIds));
    for (const row of rows) {
      targets.set(`flight:${row.id}`, {
        reportedUserId: row.createdById,
        contentPath: `/flights/${row.publicId}`,
        contentPreview: preview(row.name, `Flight #${row.id}`),
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

export interface ReportClosure {
  /** The moderator who acted, or null when the system closed the report. */
  closedById: number | null;
  /** What happened, shown in Moderation History. */
  note: string;
}

/**
 * Resolve every open report about one target because the content is gone or
 * has been dealt with. Called by the operations that remove content so the
 * Inbox never keeps a report about something moderators cannot act on.
 */
export async function closeOpenReportsForTarget(
  db: AnyDatabase,
  key: ReportTargetKey,
  closure: ReportClosure,
): Promise<void> {
  await db
    .update(reports)
    .set({
      status: "resolved",
      closedById: closure.closedById,
      closedAt: new Date(),
      closeNote: closure.note,
    })
    .where(
      and(
        eq(reports.objectType, key.objectType),
        eq(reports.objectId, key.objectId),
        eq(reports.status, "open"),
      ),
    );
}

/**
 * Resolve open reports that name a member, limited to the target types the
 * action settled. Suspending a member settles only the report about them;
 * their content stays visible. Deleting an account removes the member's
 * content but not catalog records they added, so those reports stay open.
 */
export async function closeOpenReportsAboutMember(
  db: AnyDatabase,
  userId: number,
  objectTypes: readonly ReportObjectType[],
  closure: ReportClosure,
): Promise<void> {
  await db
    .update(reports)
    .set({
      status: "resolved",
      closedById: closure.closedById,
      closedAt: new Date(),
      closeNote: closure.note,
    })
    .where(
      and(
        eq(reports.reportedUserId, userId),
        inArray(reports.objectType, [...objectTypes]),
        eq(reports.status, "open"),
      ),
    );
}

/** Report targets that account deletion removes along with the member. */
export const MEMBER_CONTENT_REPORT_OBJECT_TYPES: readonly ReportObjectType[] = [
  "user",
  "tasting",
  "member_review",
  "comment",
  "flight",
];
