import { db, type AnyDatabase } from "@peated/server/db";
import {
  incomingBottleDecisionLogs,
  type IncomingBottleDecisionLog,
} from "@peated/server/db/schema";

export type IncomingBottleDecisionType = IncomingBottleDecisionLog["decision"];
export type IncomingBottleDecisionActorType =
  IncomingBottleDecisionLog["actorType"];
export type IncomingBottleDecisionSourceKind =
  IncomingBottleDecisionLog["sourceKind"];

export function normalizeIncomingBottleDecisionConfidence(
  confidence: number | null | undefined,
): number | null {
  if (confidence === null || confidence === undefined) {
    return null;
  }

  const percentageConfidence = confidence <= 1 ? confidence * 100 : confidence;
  return Math.min(100, Math.max(0, Math.round(percentageConfidence)));
}

export function getIncomingBottleDecisionFromResolutionSource(
  source: string,
): IncomingBottleDecisionType | null {
  switch (source) {
    case "classifier_match":
      return "match_existing";
    case "classifier_create_bottle":
      return "create_bottle";
    case "classifier_create_release":
      return "create_release";
    case "classifier_create_bottle_and_release":
      return "create_bottle_and_release";
    default:
      return null;
  }
}

export function getIncomingBottleDecisionFromCreationTarget(
  creationTarget: "bottle" | "release" | "bottle_and_release",
): IncomingBottleDecisionType {
  switch (creationTarget) {
    case "bottle":
      return "create_bottle";
    case "release":
      return "create_release";
    case "bottle_and_release":
      return "create_bottle_and_release";
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
    actorType,
    actorUserId = null,
    bottleId,
    releaseId = null,
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
    actorType: IncomingBottleDecisionActorType;
    actorUserId?: number | null;
    bottleId: number;
    releaseId?: number | null;
    createdBottle?: boolean;
    createdRelease?: boolean;
    confidence?: number | null;
    model?: string | null;
    rationale?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
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
      actorType,
      actorUserId,
      bottleId,
      releaseId,
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
