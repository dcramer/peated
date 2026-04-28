import {
  db as defaultDb,
  type AnyDatabase,
  type AnyTransaction,
} from "@peated/server/db";
import type { BottleSeries, Entity, User } from "@peated/server/db/schema";
import {
  bottleReleases,
  bottles,
  bottleSeries,
  bottlesToDistillers,
  changes,
} from "@peated/server/db/schema";
import { processSeries } from "@peated/server/lib/bottleHelpers";
import { upsertBottleAlias } from "@peated/server/lib/db";
import { formatBottleName, formatReleaseName } from "@peated/server/lib/format";
import { logError } from "@peated/server/lib/log";
import { pushUniqueJob } from "@peated/server/worker/client";
import { and, asc, eq, ilike, inArray, sql } from "drizzle-orm";

type RepairSeriesAction = "none" | "reuse_existing" | "create_new";
type RepairStatus = "planned" | "applied" | "failed";

export type RepairBottleBrandDistilleryAssignmentItem = {
  bottleFullName: string;
  bottleId: number;
  distilleryAdded: boolean;
  message: string;
  releaseCount: number;
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
type CandidateRelease = typeof bottleReleases.$inferSelect;

function buildSummary(
  items: RepairBottleBrandDistilleryAssignmentItem[],
): RepairBottleBrandDistilleryAssignmentResult["summary"] {
  return items.reduce(
    (summary, item) => {
      summary.total += 1;

      if (item.status === "planned") {
        summary.planned += 1;
      } else if (item.status === "applied") {
        summary.applied += 1;
      } else if (item.status === "failed") {
        summary.failed += 1;
      }

      if (item.seriesAction === "create_new") {
        summary.seriesCreated += 1;
      } else if (item.seriesAction === "reuse_existing") {
        summary.seriesReused += 1;
      }

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

async function syncSeriesBottleCount({
  db,
  seriesId,
}: {
  db: AnyDatabase;
  seriesId: number;
}) {
  await db
    .update(bottleSeries)
    .set({
      numReleases: sql`(
        SELECT COUNT(*)
        FROM ${bottles}
        WHERE ${bottles.seriesId} = ${seriesId}
      )`,
    })
    .where(eq(bottleSeries.id, seriesId));
}

async function ensureTargetSeries({
  currentSeries,
  db,
  toBrand,
  userId,
}: {
  currentSeries: BottleSeries;
  db: AnyTransaction;
  toBrand: Entity;
  userId: number;
}) {
  if (currentSeries.brandId === toBrand.id) {
    return {
      created: false,
      seriesAction: "none" as const,
      seriesId: currentSeries.id,
    };
  }

  const [seriesId, created] = await processSeries({
    tx: db,
    series: {
      description: currentSeries.description,
      name: currentSeries.name,
    },
    brand: toBrand,
    userId,
  });

  if (!seriesId) {
    throw new Error("Failed to resolve target series.");
  }

  return {
    created,
    seriesAction: created
      ? ("create_new" as const)
      : ("reuse_existing" as const),
    seriesId,
  };
}

function buildBottleFullName({
  bottle,
  brand,
}: {
  bottle: CandidateBottle;
  brand: Entity;
}) {
  return formatBottleName({
    ...bottle,
    name: `${brand.shortName || brand.name} ${bottle.name}`,
  });
}

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

  const where = and(
    eq(bottles.brandId, fromBrand.id),
    bottleIds.length ? inArray(bottles.id, bottleIds) : undefined,
    query.trim().length
      ? ilike(bottles.fullName, `%${query.trim()}%`)
      : undefined,
  );

  const bottleQuery = db
    .select()
    .from(bottles)
    .where(where)
    .orderBy(asc(bottles.id));

  const candidateBottles = (
    limit ? await bottleQuery.limit(limit) : await bottleQuery
  ) as CandidateBottle[];

  if (candidateBottles.length === 0) {
    return {
      items: [],
      summary: {
        applied: 0,
        failed: 0,
        planned: 0,
        seriesCreated: 0,
        seriesReused: 0,
        total: 0,
      },
    };
  }

  const candidateBottleIds = candidateBottles.map(({ id }) => id);
  const candidateSeriesIds = Array.from(
    new Set(
      candidateBottles
        .map((bottle) => bottle.seriesId)
        .filter((seriesId): seriesId is number => Boolean(seriesId)),
    ),
  );

  const [distilleryRows, releaseRows, sourceSeriesRows] = await Promise.all([
    db
      .select({
        bottleId: bottlesToDistillers.bottleId,
        distilleryId: bottlesToDistillers.distillerId,
      })
      .from(bottlesToDistillers)
      .where(inArray(bottlesToDistillers.bottleId, candidateBottleIds)),
    candidateBottleIds.length
      ? db
          .select()
          .from(bottleReleases)
          .where(inArray(bottleReleases.bottleId, candidateBottleIds))
      : Promise.resolve([] as CandidateRelease[]),
    candidateSeriesIds.length
      ? db
          .select()
          .from(bottleSeries)
          .where(inArray(bottleSeries.id, candidateSeriesIds))
      : Promise.resolve([] as BottleSeries[]),
  ]);

  const distilleryIdsByBottleId = new Map<number, Set<number>>();
  for (const row of distilleryRows) {
    const current = distilleryIdsByBottleId.get(row.bottleId) ?? new Set();
    current.add(row.distilleryId);
    distilleryIdsByBottleId.set(row.bottleId, current);
  }

  const releasesByBottleId = new Map<number, CandidateRelease[]>();
  for (const row of releaseRows) {
    const current = releasesByBottleId.get(row.bottleId) ?? [];
    current.push(row);
    releasesByBottleId.set(row.bottleId, current);
  }

  const sourceSeriesById = new Map(
    sourceSeriesRows.map((series) => [series.id, series]),
  );

  const targetSeriesNameList = Array.from(
    new Set(
      sourceSeriesRows.map((series) =>
        `${toBrand.name} ${series.name}`.toLowerCase(),
      ),
    ),
  );

  const existingTargetSeriesRows =
    targetSeriesNameList.length > 0
      ? await db
          .select()
          .from(bottleSeries)
          .where(
            inArray(sql`LOWER(${bottleSeries.fullName})`, targetSeriesNameList),
          )
      : [];

  const existingTargetSeriesByFullName = new Map(
    existingTargetSeriesRows.map((series) => [
      series.fullName.toLowerCase(),
      series,
    ]),
  );

  const items: RepairBottleBrandDistilleryAssignmentItem[] = [];
  const touchedEntityIds = new Set<number>([fromBrand.id, toBrand.id]);
  if (distilleryId) {
    touchedEntityIds.add(distilleryId);
  }

  for (const bottle of candidateBottles) {
    const bottleDistilleryIds =
      distilleryIdsByBottleId.get(bottle.id) ?? new Set();
    const releaseList = releasesByBottleId.get(bottle.id) ?? [];
    const shouldAddDistillery =
      distilleryId !== null && !bottleDistilleryIds.has(distilleryId);
    const nextBottleFullName = buildBottleFullName({
      bottle,
      brand: toBrand,
    });

    let seriesAction: RepairSeriesAction = "none";
    const currentSeries = bottle.seriesId
      ? (sourceSeriesById.get(bottle.seriesId) ?? null)
      : null;

    if (currentSeries && currentSeries.brandId !== toBrand.id) {
      const existingTargetSeries = existingTargetSeriesByFullName.get(
        `${toBrand.name} ${currentSeries.name}`.toLowerCase(),
      );
      seriesAction = existingTargetSeries ? "reuse_existing" : "create_new";
    }

    const baseMessage = [
      `brand ${fromBrand.name} -> ${toBrand.name}`,
      nextBottleFullName !== bottle.fullName
        ? `rename ${bottle.fullName} -> ${nextBottleFullName}`
        : null,
      shouldAddDistillery && distilleryId
        ? `add distillery ${
            fromBrand.id === distilleryId ? fromBrand.name : "link"
          }`
        : null,
      currentSeries && seriesAction !== "none"
        ? `${seriesAction === "create_new" ? "create" : "reuse"} series ${currentSeries.name}`
        : null,
      releaseList.length ? `${releaseList.length} release(s) reindexed` : null,
    ]
      .filter(Boolean)
      .join("; ");

    if (dryRun) {
      items.push({
        bottleFullName: nextBottleFullName,
        bottleId: bottle.id,
        distilleryAdded: shouldAddDistillery,
        message: baseMessage,
        releaseCount: releaseList.length,
        seriesAction,
        status: "planned",
      });
      continue;
    }

    try {
      let createdSeriesId: number | null = null;
      let nextSeriesId = bottle.seriesId ?? null;

      await db.transaction(async (tx) => {
        if (currentSeries) {
          const ensuredSeries = await ensureTargetSeries({
            currentSeries,
            db: tx,
            toBrand,
            userId: user!.id,
          });
          nextSeriesId = ensuredSeries.seriesId;
          seriesAction = ensuredSeries.seriesAction;
          if (ensuredSeries.created) {
            createdSeriesId = ensuredSeries.seriesId;
          }
        }

        if (shouldAddDistillery && distilleryId) {
          await tx
            .insert(bottlesToDistillers)
            .values({
              bottleId: bottle.id,
              distillerId: distilleryId,
            })
            .onConflictDoNothing();
        }

        const bottleAlias = await upsertBottleAlias(
          tx,
          nextBottleFullName,
          bottle.id,
        );
        if (bottleAlias.bottleId !== bottle.id) {
          throw new Error(
            "Target bottle full name already belongs to a different bottle.",
          );
        }

        await tx
          .update(bottles)
          .set({
            brandId: toBrand.id,
            fullName: nextBottleFullName,
            seriesId: nextSeriesId,
            updatedAt: sql`NOW()`,
          })
          .where(eq(bottles.id, bottle.id));

        for (const release of releaseList) {
          const nextReleaseName = formatReleaseName({
            name: bottle.name,
            edition: release.edition,
            abv: release.abv,
            statedAge: bottle.statedAge ? null : release.statedAge,
            releaseYear: release.releaseYear,
            vintageYear: release.vintageYear,
            singleCask: release.singleCask,
            caskStrength: release.caskStrength,
            caskFill: release.caskFill,
            caskType: release.caskType,
            caskSize: release.caskSize,
          });
          const nextReleaseFullName = formatReleaseName({
            name: nextBottleFullName,
            edition: release.edition,
            abv: release.abv,
            statedAge: bottle.statedAge ? null : release.statedAge,
            releaseYear: release.releaseYear,
            vintageYear: release.vintageYear,
            singleCask: release.singleCask,
            caskStrength: release.caskStrength,
            caskFill: release.caskFill,
            caskType: release.caskType,
            caskSize: release.caskSize,
          });

          const releaseAlias = await upsertBottleAlias(
            tx,
            nextReleaseFullName,
            bottle.id,
            release.id,
          );
          if (
            releaseAlias.bottleId !== bottle.id ||
            (releaseAlias.releaseId ?? null) !== release.id
          ) {
            throw new Error(
              "Target release full name already belongs to a different bottle.",
            );
          }

          await tx
            .update(bottleReleases)
            .set({
              fullName: nextReleaseFullName,
              name: nextReleaseName,
              updatedAt: sql`NOW()`,
            })
            .where(eq(bottleReleases.id, release.id));
        }

        if (currentSeries && nextSeriesId !== currentSeries.id) {
          await syncSeriesBottleCount({
            db: tx,
            seriesId: currentSeries.id,
          });
        }
        if (nextSeriesId) {
          await syncSeriesBottleCount({
            db: tx,
            seriesId: nextSeriesId,
          });
        }

        await tx.insert(changes).values({
          objectId: bottle.id,
          objectType: "bottle",
          type: "update",
          displayName: nextBottleFullName,
          createdById: user!.id,
          data: {
            brandId: toBrand.id,
            ...(nextBottleFullName !== bottle.fullName
              ? { fullName: nextBottleFullName }
              : {}),
            distillerIds:
              shouldAddDistillery && distilleryId ? [distilleryId] : undefined,
            seriesId:
              nextSeriesId !== bottle.seriesId ? nextSeriesId : undefined,
          },
        });
      });

      await pushUniqueJob(
        "OnBottleChange",
        { bottleId: bottle.id },
        { delay: 5000 },
      );

      for (const release of releaseList) {
        await pushUniqueJob(
          "OnBottleReleaseChange",
          { releaseId: release.id },
          { delay: 5000 },
        );
      }

      if (createdSeriesId) {
        await pushUniqueJob(
          "IndexBottleSeriesSearchVectors",
          { seriesId: createdSeriesId },
          { delay: 5000 },
        );
      }

      items.push({
        bottleFullName: nextBottleFullName,
        bottleId: bottle.id,
        distilleryAdded: shouldAddDistillery,
        message: baseMessage,
        releaseCount: releaseList.length,
        seriesAction,
        status: "applied",
      });
    } catch (err) {
      logError(err, {
        bottle: {
          id: bottle.id,
        },
      });

      items.push({
        bottleFullName: bottle.fullName,
        bottleId: bottle.id,
        distilleryAdded: shouldAddDistillery,
        message: err instanceof Error ? err.message : "Unknown repair failure.",
        releaseCount: releaseList.length,
        seriesAction,
        status: "failed",
      });
    }
  }

  if (!dryRun) {
    for (const entityId of touchedEntityIds) {
      try {
        await pushUniqueJob("OnEntityChange", { entityId }, { delay: 5000 });
      } catch (err) {
        logError(err, {
          entity: {
            id: entityId,
          },
        });
      }
    }
  }

  return {
    items,
    summary: buildSummary(items),
  };
}
