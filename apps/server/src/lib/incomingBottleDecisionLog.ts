import type { AnyTransaction } from "@peated/server/db";
import {
  incomingBottleDecisionLogs,
  type Actor,
  type IncomingBottleDecisionLog,
} from "@peated/server/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { priceMatchProposalHistory } from "./reopenStorePriceMatches";

export type IncomingBottleDecisionType = Extract<
  IncomingBottleDecisionLog["decision"],
  "match" | "create_bottle" | "unassign"
>;
export type IncomingBottleDecisionSourceKind =
  IncomingBottleDecisionLog["sourceKind"];
export type IncomingBottleDecisionActor = Pick<Actor, "id" | "type" | "userId">;

export interface IncomingBottleDecisionMetadata {
  referenceScope?: "global_alias" | "none";
  classifierEvidence?: unknown;
  creationSource?: string;
  gtin14?: string;
  initiatedByUserId?: number;
  issue?: string | null;
  matchingBasis?: string;
  proposalType?: string;
  resolutionSource?: string;
  reusedExistingBottle?: boolean;
  previousBottleId?: number | null;
  referenceId?: number;
  previousReferenceId?: number;
  previousProposal?: ReturnType<typeof priceMatchProposalHistory>;
}

const IncomingBottleDecisionMetadataSchema = z.record(z.string(), z.json());

/** Audit decisions record the Bottle effect, never a classifier verb. */
export function getIncomingBottleDecisionFromResolutionSource(
  source: string,
  { createdBottle }: { createdBottle: boolean },
): IncomingBottleDecisionType | null {
  switch (source) {
    case "classifier_match":
    case "exact_reference":
      return "match";
    case "classifier_create_bottle":
      return createdBottle === false ? "match" : "create_bottle";
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
  return (previousBottleId ?? null) !== (bottleId ?? null) && decision !== null;
}

export async function recordIncomingBottleDecisionInTransaction(
  tx: AnyTransaction,
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
    bottleId: number | null;
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
  if (decision === "unassign" && bottleId !== null) {
    throw new Error("An unassignment decision cannot assign a Bottle.");
  }

  // Matching owns retry safety: serialize decisions for one source, not its lifetime.
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`incoming-bottle-decision:${sourceKind}:${sourceId}`}, 0))`,
  );
  const [previous] = await tx
    .select()
    .from(incomingBottleDecisionLogs)
    .where(
      and(
        eq(incomingBottleDecisionLogs.sourceKind, sourceKind),
        eq(incomingBottleDecisionLogs.sourceId, sourceId),
      ),
    )
    .orderBy(desc(incomingBottleDecisionLogs.id))
    .limit(1);
  if (
    previous &&
    previous.bottleId === bottleId &&
    previous.decision === decision &&
    previous.actorId === actor.id &&
    previous.metadata.resolutionSource === metadata.resolutionSource
  )
    return null;

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
    .returning();

  return log ?? null;
}
