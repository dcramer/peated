import { db, type AnyDatabase } from "@peated/server/db";
import {
  incomingBottleDecisionLogs,
  type Actor,
  type IncomingBottleDecisionLog,
} from "@peated/server/db/schema";

export type IncomingBottleDecisionType = IncomingBottleDecisionLog["decision"];
export type IncomingBottleDecisionSourceKind =
  IncomingBottleDecisionLog["sourceKind"];
export type IncomingBottleDecisionActor = Pick<Actor, "id" | "type" | "userId">;

/**
 * Legacy classifier source names remain evidence; audit decisions record the
 * persisted concrete Bottle effect (`create_bottle` or `match_existing`), never release creation.
 */
export function getIncomingBottleDecisionFromResolutionSource(
  source: string,
  { createdBottle }: { createdBottle: boolean },
): IncomingBottleDecisionType | null {
  switch (source) {
    case "classifier_match":
      return "match_existing";
    case "classifier_create_bottle":
      return createdBottle === false ? "match_existing" : "create_bottle";
    case "classifier_create_release":
      return createdBottle ? "create_bottle" : "match_existing";
    case "classifier_create_bottle_and_release":
      return createdBottle ? "create_bottle" : "match_existing";
    case "classifier_repair_parent_and_create_release":
      return createdBottle === false ? "match_existing" : "create_bottle";
    default:
      return null;
  }
}

export function shouldRecordIncomingBottleDecision({
  previousBottleId,
  bottleId,
  decision,
}: {
  previousBottleId: number | null | undefined;
  bottleId: number | null | undefined;
  decision: IncomingBottleDecisionType | null;
}) {
  return previousBottleId == null && bottleId != null && decision !== null;
}

export async function recordIncomingBottleDecisionInTransaction(
  tx: AnyDatabase,
  {
    sourceKind,
    sourceId,
    proposalId = null,
    externalSiteId,
    name,
    url = null,
    decision,
    actor,
    bottleId,
    releaseId = null,
    targetId = null,
    createdBottle = false,
    createdRelease = false,
    confidence = null,
    model = null,
    rationale = null,
    metadata = {},
  }: {
    sourceKind: IncomingBottleDecisionSourceKind;
    sourceId: number;
    proposalId?: number | null;
    externalSiteId: number;
    name: string;
    url?: string | null;
    decision: IncomingBottleDecisionType;
    actor: IncomingBottleDecisionActor;
    bottleId: number;
    releaseId?: number | null;
    targetId?: number | null;
    createdBottle?: boolean;
    createdRelease?: boolean;
    confidence?: number | null;
    model?: string | null;
    rationale?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  if (actor.type === "user" && !actor.userId) {
    throw new Error(`User actor ${actor.id} is missing user attribution.`);
  }

  const [log] = await tx
    .insert(incomingBottleDecisionLogs)
    .values({
      sourceKind,
      sourceId,
      proposalId,
      externalSiteId,
      name,
      url,
      decision,
      actorId: actor.id,
      bottleId,
      releaseId,
      targetId,
      createdBottle,
      createdRelease,
      confidence,
      model,
      rationale,
      metadata,
    })
    .onConflictDoNothing({
      target: [
        incomingBottleDecisionLogs.sourceKind,
        incomingBottleDecisionLogs.sourceId,
      ],
    })
    .returning();

  return log ?? null;
}

export async function recordIncomingBottleDecision(
  input: Parameters<typeof recordIncomingBottleDecisionInTransaction>[1],
) {
  return await db.transaction(async (tx) =>
    recordIncomingBottleDecisionInTransaction(tx, input),
  );
}
