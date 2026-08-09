import { db as defaultDb, type AnyDatabase } from "@peated/server/db";
import type {
  BottleGroup,
  BottleSeries,
  Entity,
  User,
} from "@peated/server/db/schema";
import {
  bottleGroupDistillers,
  bottleGroups,
  bottles,
  bottleSeries,
  users,
} from "@peated/server/db/schema";
import { getUserActorByIdForDatabase } from "@peated/server/lib/actors";
import {
  getBottleExactIdentity,
  materializeBottleForGroup,
} from "@peated/server/lib/bottleIdentity";
import { formatBottleName } from "@peated/server/lib/format";
import { logError } from "@peated/server/lib/log";
import {
  bottleUpdateExpectedSharedState,
  finalizeBottleUpdate,
  updateBottleInTransaction,
} from "@peated/server/lib/updateBottle";
import { and, asc, eq, ilike, inArray, sql } from "drizzle-orm";

type RepairSeriesAction = "none" | "reuse_existing" | "create_new";
type RepairStatus = "planned" | "applied" | "failed";

export type RepairBottleBrandDistilleryAssignmentItem = {
  bottleFullName: string;
  bottleId: number;
  distilleryAdded: boolean;
  groupId: number | null;
  message: string;
  seriesAction: RepairSeriesAction;
  status: RepairStatus;
};

export type RepairBottleBrandDistilleryAssignmentResult = {
  items: RepairBottleBrandDistilleryAssignmentItem[];
  summary: {
    applied: number;
    failed: number;
    planned: number;
    seriesCreated: number;
    seriesReused: number;
    total: number;
  };
};

type RepairBottleBrandDistilleryAssignmentOptions = {
  bottleIds?: number[];
  db?: AnyDatabase;
  distilleryId?: number | null;
  dryRun?: boolean;
  fromBrand: Entity;
  limit?: number | null;
  query?: string;
  toBrand: Entity;
  user?: Pick<User, "id">;
};

type CandidateBottle = typeof bottles.$inferSelect;

function buildSummary(
  items: RepairBottleBrandDistilleryAssignmentItem[],
): RepairBottleBrandDistilleryAssignmentResult["summary"] {
  return items.reduce(
    (summary, item) => {
      summary.total += 1;
      summary[item.status] += 1;
      if (item.seriesAction === "create_new") summary.seriesCreated += 1;
      if (item.seriesAction === "reuse_existing") summary.seriesReused += 1;
      return summary;
    },
    {
      applied: 0,
      failed: 0,
      planned: 0,
      seriesCreated: 0,
      seriesReused: 0,
      total: 0,
    },
  );
}

function materializeTargetBottle({
  bottle,
  group,
  brand,
}: {
  bottle: CandidateBottle;
  group: BottleGroup;
  brand: Entity;
}) {
  const targetGroup = {
    ...group,
    brandId: brand.id,
    fullName: formatBottleName({
      name: `${brand.shortName || brand.name} ${group.name}`,
    }),
  };
  return materializeBottleForGroup({
    group: targetGroup,
    exact: getBottleExactIdentity({
      bottle,
      sourceGroupStatedAge: group.statedAge,
    }),
  });
}

/**
 * Plans or applies one canonical shared repair per BottleGroup. Applied edits
 * validate the previewed shared authority under the canonical group lock and
 * fan out complete identity materialization to every Bottle member.
 */
export async function repairBottleBrandDistilleryAssignments({
  bottleIds = [],
  db = defaultDb,
  distilleryId = null,
  dryRun = true,
  fromBrand,
  limit = null,
  query = "",
  toBrand,
  user,
}: RepairBottleBrandDistilleryAssignmentOptions): Promise<RepairBottleBrandDistilleryAssignmentResult> {
  if (fromBrand.id === toBrand.id) {
    throw new Error("Source and target brand must be different.");
  }
  if (!dryRun && !user) {
    throw new Error("A user is required to apply bottle brand repairs.");
  }

  const candidateQuery = db
    .select()
    .from(bottles)
    .where(
      and(
        eq(bottles.brandId, fromBrand.id),
        bottleIds.length ? inArray(bottles.id, bottleIds) : undefined,
        query.trim().length
          ? ilike(bottles.fullName, `%${query.trim()}%`)
          : undefined,
      ),
    )
    .orderBy(asc(bottles.id));
  const candidates = (
    limit ? await candidateQuery.limit(limit) : await candidateQuery
  ) as CandidateBottle[];

  const items: RepairBottleBrandDistilleryAssignmentItem[] = [];
  const groupedCandidates = new Map<number, CandidateBottle[]>();
  for (const bottle of candidates) {
    if (bottle.groupId === null) {
      items.push({
        bottleFullName: bottle.fullName,
        bottleId: bottle.id,
        distilleryAdded: false,
        groupId: null,
        message:
          "BottleGroup migration is required before applying this shared repair.",
        seriesAction: "none",
        status: "failed",
      });
      continue;
    }
    const group = groupedCandidates.get(bottle.groupId) ?? [];
    group.push(bottle);
    groupedCandidates.set(bottle.groupId, group);
  }

  if (groupedCandidates.size === 0) {
    return { items, summary: buildSummary(items) };
  }

  const groupIds = Array.from(groupedCandidates.keys()).sort(
    (left, right) => left - right,
  );
  const groupDistillers = await db
    .select()
    .from(bottleGroupDistillers)
    .where(inArray(bottleGroupDistillers.groupId, groupIds))
    .orderBy(
      asc(bottleGroupDistillers.groupId),
      asc(bottleGroupDistillers.distillerId),
    );
  const distillersByGroupId = new Map<number, number[]>();
  for (const row of groupDistillers) {
    const ids = distillersByGroupId.get(row.groupId) ?? [];
    ids.push(row.distillerId);
    distillersByGroupId.set(row.groupId, ids);
  }

  const groupRows = await db
    .select()
    .from(bottleGroups)
    .where(inArray(bottleGroups.id, groupIds));
  const groupById = new Map(groupRows.map((group) => [group.id, group]));

  const seriesIds = Array.from(
    new Set(
      groupRows
        .map(({ seriesId }) => seriesId)
        .filter((seriesId): seriesId is number => seriesId !== null),
    ),
  );
  const sourceSeriesRows = seriesIds.length
    ? await db
        .select()
        .from(bottleSeries)
        .where(inArray(bottleSeries.id, seriesIds))
    : [];
  const sourceSeriesById = new Map(
    sourceSeriesRows.map((series) => [series.id, series]),
  );
  const targetSeriesNames = sourceSeriesRows.map((series) =>
    `${toBrand.name} ${series.name}`.toLowerCase(),
  );
  const targetSeriesRows = targetSeriesNames.length
    ? await db
        .select()
        .from(bottleSeries)
        .where(inArray(sql`LOWER(${bottleSeries.fullName})`, targetSeriesNames))
    : [];
  const targetSeriesByName = new Map(
    targetSeriesRows.map((series) => [series.fullName.toLowerCase(), series]),
  );

  for (const [groupId, groupCandidates] of groupedCandidates) {
    const selectedBottle = groupCandidates[0]!;
    const group = groupById.get(groupId);
    if (!group) {
      items.push({
        bottleFullName: selectedBottle.fullName,
        bottleId: selectedBottle.id,
        distilleryAdded: false,
        groupId,
        message: `BottleGroup ${groupId} no longer exists.`,
        seriesAction: "none",
        status: "failed",
      });
      continue;
    }
    const distillerIds = distillersByGroupId.get(groupId) ?? [];
    const shouldAddDistillery =
      distilleryId !== null && !distillerIds.includes(distilleryId);
    const currentSeries = group.seriesId
      ? (sourceSeriesById.get(group.seriesId) ?? null)
      : null;
    const targetSeries = currentSeries
      ? (targetSeriesByName.get(
          `${toBrand.name} ${currentSeries.name}`.toLowerCase(),
        ) ?? null)
      : null;
    const seriesAction: RepairSeriesAction =
      currentSeries && currentSeries.brandId !== toBrand.id
        ? targetSeries
          ? "reuse_existing"
          : "create_new"
        : "none";
    const targetBottle = materializeTargetBottle({
      bottle: selectedBottle,
      group,
      brand: toBrand,
    });
    const baseMessage = [
      `brand ${fromBrand.name} -> ${toBrand.name}`,
      `BottleGroup ${groupId} fan-out`,
      targetBottle.fullName !== selectedBottle.fullName
        ? `rename ${selectedBottle.fullName} -> ${targetBottle.fullName}`
        : null,
      shouldAddDistillery ? "add distillery link" : null,
      seriesAction !== "none" && currentSeries
        ? `${seriesAction === "create_new" ? "create" : "reuse"} series ${currentSeries.name}`
        : null,
    ]
      .filter(Boolean)
      .join("; ");

    if (dryRun) {
      items.push({
        bottleFullName: targetBottle.fullName,
        bottleId: selectedBottle.id,
        distilleryAdded: shouldAddDistillery,
        groupId,
        message: baseMessage,
        seriesAction,
        status: "planned",
      });
      continue;
    }

    try {
      const manifest = await db.transaction(async (tx) => {
        const persistedUser = await tx.query.users.findFirst({
          where: eq(users.id, user!.id),
        });
        if (!persistedUser) {
          throw new Error(`Repair user ${user!.id} no longer exists.`);
        }
        const actor = await getUserActorByIdForDatabase(tx, persistedUser.id);
        return updateBottleInTransaction(tx, {
          bottleId: selectedBottle.id,
          expectedSharedState: bottleUpdateExpectedSharedState({
            group,
            distillerIds,
            referencedSeries: targetSeries ? [targetSeries] : [],
            series: currentSeries,
          }),
          input: {
            shared: {
              brand: toBrand.id,
              ...(shouldAddDistillery
                ? {
                    distillers: Array.from(
                      new Set([...distillerIds, distilleryId!]),
                    ).sort((left, right) => left - right),
                  }
                : {}),
              ...(currentSeries && currentSeries.brandId !== toBrand.id
                ? {
                    series: targetSeries?.id ?? {
                      name: currentSeries.name,
                      description: currentSeries.description,
                    },
                  }
                : {}),
            },
          },
          user: persistedUser,
          actorId: actor.id,
          creationSource: "repair_workflow",
        });
      });
      await finalizeBottleUpdate(manifest);
      items.push({
        bottleFullName: manifest.bottle.fullName,
        bottleId: selectedBottle.id,
        distilleryAdded: shouldAddDistillery,
        groupId,
        message: baseMessage,
        seriesAction,
        status: "applied",
      });
    } catch (error) {
      logError(error, { bottle: { id: selectedBottle.id } });
      items.push({
        bottleFullName: selectedBottle.fullName,
        bottleId: selectedBottle.id,
        distilleryAdded: shouldAddDistillery,
        groupId,
        message:
          error instanceof Error ? error.message : "Unknown repair failure.",
        seriesAction,
        status: "failed",
      });
    }
  }

  return { items, summary: buildSummary(items) };
}
