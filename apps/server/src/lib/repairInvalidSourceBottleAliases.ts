import { db as defaultDb, type AnyDatabase } from "@peated/server/db";
import type { User } from "@peated/server/db/schema";
import {
  bottleAliases,
  bottles,
  changes,
  incomingBottleDecisionLogs,
  storePriceMatchProposals,
  users,
} from "@peated/server/db/schema";
import { getUserActorByIdForDatabase } from "@peated/server/lib/actors";
import { logError } from "@peated/server/lib/log";
import { normalizeBottleAliasKey } from "@peated/server/lib/normalize";
import { and, asc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";

type RepairStatus = "applied" | "failed" | "planned" | "review_required";

export type InvalidSourceBottleAliasRepairItem = {
  aliasName: string;
  bottleId: number | null;
  evidenceProposalIds: number[];
  message: string;
  status: RepairStatus;
};

export type InvalidSourceBottleAliasRepairResult = {
  items: InvalidSourceBottleAliasRepairItem[];
  summary: Record<RepairStatus | "total", number>;
};

type RepairOptions = {
  aliasNames?: string[];
  db?: AnyDatabase;
  dryRun?: boolean;
  limit?: number;
  user?: Pick<User, "id">;
};

type Candidate = {
  name: string;
  bottleId: number;
  ignored: boolean | null;
  assignmentSource: typeof bottleAliases.$inferSelect.assignmentSource;
  assignedByActorId: number;
  bottleFullName: string;
};

async function inspectCandidate(database: AnyDatabase, candidate: Candidate) {
  const evidence = await database
    .select({
      decisionName: incomingBottleDecisionLogs.name,
      proposalId: storePriceMatchProposals.id,
    })
    .from(incomingBottleDecisionLogs)
    .innerJoin(
      storePriceMatchProposals,
      eq(storePriceMatchProposals.id, incomingBottleDecisionLogs.proposalId),
    )
    .where(
      and(
        eq(incomingBottleDecisionLogs.sourceKind, "store_price"),
        eq(incomingBottleDecisionLogs.bottleId, candidate.bottleId),
        eq(storePriceMatchProposals.status, "approved"),
        eq(storePriceMatchProposals.currentBottleId, candidate.bottleId),
        or(
          isNull(storePriceMatchProposals.aliasScope),
          eq(storePriceMatchProposals.aliasScope, "none"),
        ),
      ),
    )
    .orderBy(asc(storePriceMatchProposals.id));
  const evidenceProposalIds = evidence
    .filter(
      ({ decisionName }) =>
        normalizeBottleAliasKey(decisionName).toLowerCase() ===
        candidate.name.toLowerCase(),
    )
    .map(({ proposalId }) => proposalId);

  if (candidate.assignmentSource !== "source_approved") {
    return {
      eligible: false,
      evidenceProposalIds,
      message: "BottleAlias was not assigned by a StorePrice approval.",
    };
  }
  if (!candidate.ignored) {
    return {
      eligible: false,
      evidenceProposalIds,
      message: "Active BottleAlias requires manual review.",
    };
  }
  const canonicalNames = new Set([
    candidate.bottleFullName.trim().toLowerCase(),
    normalizeBottleAliasKey(candidate.bottleFullName).toLowerCase(),
  ]);
  if (canonicalNames.has(candidate.name.toLowerCase())) {
    return {
      eligible: false,
      evidenceProposalIds,
      message:
        "BottleAlias matches the Bottle name and requires manual review.",
    };
  }
  if (evidenceProposalIds.length === 0) {
    return {
      eligible: false,
      evidenceProposalIds,
      message:
        "No approved source-only StorePrice decision proves this repair.",
    };
  }
  return {
    eligible: true,
    evidenceProposalIds,
    message:
      "Unassign ignored BottleAlias so it no longer blocks a later valid assignment.",
  };
}

function buildSummary(items: InvalidSourceBottleAliasRepairItem[]) {
  return items.reduce<InvalidSourceBottleAliasRepairResult["summary"]>(
    (summary, item) => {
      summary.total += 1;
      summary[item.status] += 1;
      return summary;
    },
    { applied: 0, failed: 0, planned: 0, review_required: 0, total: 0 },
  );
}

/**
 * Audits legacy BottleAlias rows touched by source-only StorePrice approvals.
 * Execution requires explicit alias names and only unassigns ignored rows with
 * matching approved proposal evidence.
 */
export async function repairInvalidSourceBottleAliases({
  aliasNames = [],
  db = defaultDb,
  dryRun = true,
  limit = 100,
  user,
}: RepairOptions): Promise<InvalidSourceBottleAliasRepairResult> {
  if (!dryRun && aliasNames.length === 0) {
    throw new Error(
      "Execution requires one or more explicit BottleAlias names.",
    );
  }
  if (!dryRun && !user) {
    throw new Error("A user is required to repair BottleAlias rows.");
  }

  let repairActorId: number | null = null;
  if (!dryRun) {
    const persistedUser = await db.query.users.findFirst({
      where: eq(users.id, user!.id),
    });
    if (!persistedUser) {
      throw new Error(`Repair user ${user!.id} no longer exists.`);
    }
    repairActorId = (await getUserActorByIdForDatabase(db, persistedUser.id))
      .id;
  }

  const requestedNames = Array.from(
    new Set(
      aliasNames.map((name) => name.trim().toLowerCase()).filter(Boolean),
    ),
  );
  const rows = await db
    .select({
      name: bottleAliases.name,
      bottleId: bottleAliases.bottleId,
      ignored: bottleAliases.ignored,
      assignmentSource: bottleAliases.assignmentSource,
      assignedByActorId: bottleAliases.assignedByActorId,
      bottleFullName: bottles.fullName,
    })
    .from(bottleAliases)
    .innerJoin(bottles, eq(bottles.id, bottleAliases.bottleId))
    .where(
      and(
        isNotNull(bottleAliases.bottleId),
        requestedNames.length
          ? inArray(sql`LOWER(${bottleAliases.name})`, requestedNames)
          : eq(bottleAliases.assignmentSource, "source_approved"),
      ),
    )
    .orderBy(asc(bottleAliases.name))
    .limit(requestedNames.length || limit);
  const candidates: Candidate[] = rows.flatMap((row) =>
    row.bottleId === null ? [] : [{ ...row, bottleId: row.bottleId }],
  );
  const items: InvalidSourceBottleAliasRepairItem[] = [];

  for (const candidate of candidates) {
    const inspection = await inspectCandidate(db, candidate);
    if (!inspection.eligible) {
      items.push({
        aliasName: candidate.name,
        bottleId: candidate.bottleId,
        evidenceProposalIds: inspection.evidenceProposalIds,
        message: inspection.message,
        status: "review_required",
      });
      continue;
    }
    if (dryRun) {
      items.push({
        aliasName: candidate.name,
        bottleId: candidate.bottleId,
        evidenceProposalIds: inspection.evidenceProposalIds,
        message: inspection.message,
        status: "planned",
      });
      continue;
    }

    try {
      const item = await db.transaction(async (tx) => {
        const [locked] = await tx
          .select({
            name: bottleAliases.name,
            bottleId: bottleAliases.bottleId,
            ignored: bottleAliases.ignored,
            assignmentSource: bottleAliases.assignmentSource,
            assignedByActorId: bottleAliases.assignedByActorId,
            bottleFullName: bottles.fullName,
          })
          .from(bottleAliases)
          .innerJoin(bottles, eq(bottles.id, bottleAliases.bottleId))
          .where(
            eq(sql`LOWER(${bottleAliases.name})`, candidate.name.toLowerCase()),
          )
          .limit(1)
          .for("update");
        if (!locked || locked.bottleId === null) {
          throw new Error("BottleAlias changed after preview.");
        }
        const current: Candidate = {
          ...locked,
          bottleId: locked.bottleId,
        };
        const currentInspection = await inspectCandidate(tx, current);
        if (!currentInspection.eligible) {
          throw new Error(currentInspection.message);
        }
        const [updated] = await tx
          .update(bottleAliases)
          .set({ bottleId: null, embedding: null })
          .where(
            and(
              eq(bottleAliases.name, current.name),
              eq(bottleAliases.bottleId, current.bottleId),
              eq(bottleAliases.ignored, true),
              eq(bottleAliases.assignmentSource, "source_approved"),
            ),
          )
          .returning({ name: bottleAliases.name });
        if (!updated) {
          throw new Error("BottleAlias changed during repair.");
        }
        await tx.insert(changes).values({
          objectType: "bottle",
          objectId: current.bottleId,
          actorId: repairActorId!,
          displayName: current.bottleFullName,
          type: "update",
          data: {
            updateScope: "bottle_alias_repair",
            aliasName: current.name,
            evidenceProposalIds: currentInspection.evidenceProposalIds,
            before: {
              bottleId: current.bottleId,
              ignored: current.ignored,
              assignmentSource: current.assignmentSource,
              assignedByActorId: current.assignedByActorId,
            },
            after: { bottleId: null },
          },
        });
        return {
          aliasName: current.name,
          bottleId: current.bottleId,
          evidenceProposalIds: currentInspection.evidenceProposalIds,
          message: currentInspection.message,
          status: "applied" as const,
        };
      });
      items.push(item);
    } catch (error) {
      logError(error, { bottleAlias: { name: candidate.name } });
      items.push({
        aliasName: candidate.name,
        bottleId: candidate.bottleId,
        evidenceProposalIds: inspection.evidenceProposalIds,
        message:
          error instanceof Error ? error.message : "Unknown repair failure.",
        status: "failed",
      });
    }
  }

  for (const requestedName of requestedNames) {
    if (
      !candidates.some(
        (candidate) => candidate.name.toLowerCase() === requestedName,
      )
    ) {
      items.push({
        aliasName: requestedName,
        bottleId: null,
        evidenceProposalIds: [],
        message: "Assigned BottleAlias was not found.",
        status: "review_required",
      });
    }
  }

  return { items, summary: buildSummary(items) };
}
