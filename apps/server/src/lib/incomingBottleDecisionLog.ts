import type { AnyDatabase } from "@peated/server/db";
import {
  incomingBottleDecisionLogs,
  type Actor,
  type IncomingBottleDecisionLog,
} from "@peated/server/db/schema";
import { z } from "zod";

export type IncomingBottleDecisionType = Extract<
  IncomingBottleDecisionLog["decision"],
  "match_existing" | "create_bottle"
>;
export type IncomingBottleDecisionSourceKind =
  IncomingBottleDecisionLog["sourceKind"];
export type IncomingBottleDecisionActor = Pick<Actor, "id" | "type" | "userId">;

export interface IncomingBottleDecisionMetadata {
  classifierEvidence?: unknown;
  creationSource?: string;
  gtin14?: string;
  initiatedByUserId?: number;
  issue?: string | null;
  matchingBasis?: string;
  proposalType?: string;
  resolutionSource?: string;
  reusedExistingBottle?: boolean;
}

const IncomingBottleDecisionMetadataSchema = z.record(z.string(), z.json());

/** Audit decisions record the Bottle effect, never a classifier verb. */
export function getIncomingBottleDecisionFromResolutionSource(
  source: string,
  { createdBottle }: { createdBottle: boolean },
): IncomingBottleDecisionType | null {
  switch (source) {
    case "classifier_match":
      return "match_existing";
    case "classifier_create_bottle":
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
    createdBottle = false,
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
    createdBottle?: boolean;
    confidence?: number | null;
    model?: string | null;
    rationale?: string | null;
    metadata?: IncomingBottleDecisionMetadata;
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
      createdBottle,
      confidence,
      model,
      rationale,
      metadata: IncomingBottleDecisionMetadataSchema.parse(metadata),
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
