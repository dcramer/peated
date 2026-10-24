import { BottleExtractedDetailsSchema } from "@peated/bottle-classifier/contract";
import { getBottleFieldConflicts } from "@peated/bottle-classifier/fieldConflicts";
import { normalizeBottleReferenceKey } from "@peated/bottle-classifier/normalize";
import { db } from "@peated/server/db";
import {
  auctionAlerts,
  auctionLotResults,
  auctionLots,
  auctions,
  auctionWatches,
  bottleChecks,
  bottleReferences,
  bottles,
  notifications,
  users,
  type AuctionLot,
  type BottleCheck,
} from "@peated/server/db/schema";
import {
  AuctionLotDetailObservationSchema,
  AuctionObservationSchema,
  type AuctionLotDetailObservation,
  type AuctionObservation,
} from "@peated/server/schemas/auctions";
import { and, desc, eq, lte, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import {
  getPeatedSystemActorForDatabase,
  getUserActorByIdForDatabase,
} from "./actors";
import {
  assessAuctionMatch,
  readAuctionMatchEvidence,
} from "./auctionMatchEvidence";
import {
  assignBottleReferenceInTransaction,
  finalizeBottleReferenceAssignment,
  type BottleReferenceAssignmentResult,
} from "./bottleReferences";
import { buildClassifierBottleInput } from "./classifierDecisionCreateInputs";
import {
  createOrReuseBottleInTransaction,
  finalizeCreatedBottle,
} from "./createBottle";
import {
  recordIncomingBottleDecisionInTransaction,
  type IncomingBottleDecisionMetadata,
} from "./incomingBottleDecisionLog";
import { resolveActiveBottleIds } from "./resolveActiveBottleIds";

export const AUCTION_FRESHNESS_MS = 6 * 60 * 60_000;

export function auctionAvailability(
  lot: Pick<AuctionLot, "state" | "endsAt" | "lastCheckedAt">,
  now = new Date(),
) {
  if (lot.state === "closed" || lot.state === "withdrawn")
    return "unavailable" as const;
  if (
    lot.state === "unknown" ||
    lot.lastCheckedAt.getTime() > now.getTime() ||
    now.getTime() - lot.lastCheckedAt.getTime() >= AUCTION_FRESHNESS_MS
  )
    return "unknown" as const;
  if (lot.state === "aftersale") return "aftersale" as const;
  if (lot.endsAt && lot.endsAt <= now) return "unknown" as const;
  return lot.state;
}

function identityFingerprint(
  input: Pick<AuctionLot, "name" | "volume" | "sourceBottleIdentity">,
) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        normalizeBottleReferenceKey(input.name),
        input.volume,
        input.sourceBottleIdentity,
      ]),
    )
    .digest("hex");
}

/** Auction detail reads never change availability, prices, or a match made during the read. */
export async function saveAuctionLotDetails(
  externalSiteId: number,
  raw: AuctionLotDetailObservation,
) {
  const input = AuctionLotDetailObservationSchema.parse(raw);
  const checkedAt = new Date(input.checkedAt);
  if (checkedAt.getTime() > Date.now() + 60_000)
    throw new Error("Auction detail observation is in the future.");
  return db.transaction(async (tx) => {
    const [lot] = await tx
      .select()
      .from(auctionLots)
      .where(eq(auctionLots.id, input.request.lotId))
      .for("update");
    if (!lot) return null;
    const auction = await tx.query.auctions.findFirst({
      where: eq(auctions.id, lot.auctionId),
    });
    if (!auction || auction.externalSiteId !== externalSiteId) return null;
    // Auction detail facts can change the fingerprint; replay follows the completed request.
    // Listing changes and admin retries clear or replace that request.
    if (
      lot.sourceDetailsCheckedAt &&
      lot.url === input.request.url &&
      lot.sourceDetailsRequestedAt?.toISOString() === input.request.requestedAt
    )
      return lot;
    if (
      lot.sourceFingerprint !== input.request.fingerprint ||
      lot.url !== input.request.url ||
      lot.matchCheckId !== input.request.expectedCheckId ||
      (lot.matchStatus !== "review" && lot.matchStatus !== "pending") ||
      lot.bottleId !== null ||
      !lot.sourceDetailsRequestedAt ||
      lot.sourceDetailsCheckedAt ||
      lot.sourceDetailsRequestedAt.toISOString() !==
        input.request.requestedAt ||
      checkedAt < lot.sourceDetailsRequestedAt
    )
      return null;
    const sameTitle =
      input.name !== null &&
      normalizeBottleReferenceKey(input.name) ===
        normalizeBottleReferenceKey(lot.name);
    const facts =
      sameTitle && input.sourceBottleIdentity
        ? {
            ...lot.sourceBottleIdentity,
            ...Object.fromEntries(
              Object.entries(input.sourceBottleIdentity).filter(
                ([, value]) => value != null,
              ),
            ),
          }
        : lot.sourceBottleIdentity;
    const identity = {
      name: lot.name,
      volume: sameTitle ? (input.volume ?? lot.volume) : lot.volume,
      sourceBottleIdentity: facts
        ? BottleExtractedDetailsSchema.parse(facts)
        : null,
    };
    const fingerprint = identityFingerprint(identity);
    const changed = fingerprint !== lot.sourceFingerprint;
    const [saved] = await tx
      .update(auctionLots)
      .set({
        ...identity,
        sourceDetailsCheckedAt: checkedAt,
        sourceFingerprint: fingerprint,
        matchStatus: changed ? "pending" : lot.matchStatus,
        matchCheckId: changed ? null : lot.matchCheckId,
      })
      .where(eq(auctionLots.id, lot.id))
      .returning();
    return saved ?? null;
  });
}

/** Auction ingestion owns occurrence identity; missing optional facts do not erase evidence. */
export async function upsertAuctionObservation(
  externalSiteId: number,
  raw: AuctionObservation,
) {
  const input = AuctionObservationSchema.parse(raw);
  const observedAt = new Date(input.observedAt);
  if (observedAt.getTime() > Date.now() + 60_000)
    throw new Error("Auction observation is in the future.");
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`auction:${externalSiteId}:${input.auction.sourceKey}`}, 0))`,
    );
    let [auction] = await tx
      .select()
      .from(auctions)
      .where(
        and(
          eq(auctions.externalSiteId, externalSiteId),
          eq(auctions.sourceKey, input.auction.sourceKey),
        ),
      )
      .for("update");
    const auctionValues = {
      name: input.auction.name,
      url: input.auction.url,
      startsAt:
        input.auction.startsAt === undefined
          ? (auction?.startsAt ?? null)
          : input.auction.startsAt
            ? new Date(input.auction.startsAt)
            : null,
      endsAt:
        input.auction.endsAt === undefined
          ? (auction?.endsAt ?? null)
          : input.auction.endsAt
            ? new Date(input.auction.endsAt)
            : null,
      lastCheckedAt: observedAt,
    };
    if (!auction) {
      [auction] = await tx
        .insert(auctions)
        .values({
          externalSiteId,
          sourceKey: input.auction.sourceKey,
          ...auctionValues,
        })
        .returning();
    } else if (observedAt > auction.lastCheckedAt) {
      [auction] = await tx
        .update(auctions)
        .set(auctionValues)
        .where(eq(auctions.id, auction.id))
        .returning();
    }
    if (!auction) throw new Error("Auction was not saved.");
    const [existing] = await tx
      .select()
      .from(auctionLots)
      .where(
        and(
          eq(auctionLots.auctionId, auction.id),
          eq(auctionLots.sourceKey, input.lot.sourceKey),
        ),
      )
      .for("update");
    if (existing && observedAt <= existing.lastCheckedAt)
      return { lot: existing, isNew: false };
    const sameTitle = existing?.name === input.lot.name;
    const identity = {
      name: input.lot.name,
      volume:
        input.lot.volume === undefined
          ? sameTitle
            ? (existing?.volume ?? null)
            : null
          : input.lot.volume,
      sourceBottleIdentity:
        input.lot.sourceBottleIdentity === undefined
          ? sameTitle
            ? (existing?.sourceBottleIdentity ?? null)
            : null
          : input.lot.sourceBottleIdentity,
    };
    const fingerprint = identityFingerprint(identity);
    const changed = existing && fingerprint !== existing.sourceFingerprint;
    const values: Omit<
      typeof auctionLots.$inferInsert,
      "auctionId" | "sourceKey" | "firstSeenAt"
    > = {
      ...identity,
      url: input.lot.url,
      sourceFingerprint: fingerprint,
      lotNumber:
        input.lot.lotNumber === undefined
          ? (existing?.lotNumber ?? null)
          : input.lot.lotNumber,
      imageUrl:
        input.lot.imageUrl === undefined
          ? (existing?.imageUrl ?? null)
          : input.lot.imageUrl,
      condition:
        input.lot.condition === undefined
          ? (existing?.condition ?? null)
          : input.lot.condition,
      state: input.lot.state,
      endsAt:
        input.lot.endsAt === undefined
          ? (existing?.endsAt ?? auction.endsAt ?? null)
          : input.lot.endsAt
            ? new Date(input.lot.endsAt)
            : null,
      currentBid:
        input.lot.currentBid === undefined
          ? (existing?.currentBid ?? null)
          : input.lot.currentBid,
      bidCurrency:
        input.lot.bidCurrency === undefined
          ? (existing?.bidCurrency ?? null)
          : input.lot.bidCurrency,
      lastCheckedAt: observedAt,
    };
    // Auction detail requests are pinned to their URL as well as the bottle facts.
    if (existing && (changed || existing.url !== input.lot.url)) {
      values.sourceDetailsRequestedAt = null;
      values.sourceDetailsCheckedAt = null;
      values.sourceDetailsRunId = null;
    }
    if (changed) {
      values.bottleId = null;
      values.matchStatus = "pending";
      values.matchCheckId = null;
      values.matchedReferenceId = null;
      values.matchedById = null;
      values.matchedAt = null;
      values.availableSince = null;
    }
    const [lot] = existing
      ? await tx
          .update(auctionLots)
          .set(values)
          .where(eq(auctionLots.id, existing.id))
          .returning()
      : await tx
          .insert(auctionLots)
          .values({
            auctionId: auction.id,
            sourceKey: input.lot.sourceKey,
            firstSeenAt: observedAt,
            ...values,
          })
          .returning();
    if (!lot) throw new Error("Auction lot was not saved.");
    if (
      lot.bottleId &&
      !lot.availableSince &&
      auctionAvailability(lot) === "live"
    ) {
      lot.availableSince = observedAt;
      await tx
        .update(auctionLots)
        .set({ availableSince: observedAt })
        .where(eq(auctionLots.id, lot.id));
    }
    if (input.lot.result) {
      const [previous] = await tx
        .select()
        .from(auctionLotResults)
        .where(eq(auctionLotResults.lotId, lot.id))
        .orderBy(desc(auctionLotResults.id))
        .limit(1);
      const result = {
        ...input.lot.result,
        soldAt: input.lot.result.soldAt
          ? new Date(input.lot.result.soldAt)
          : null,
      };
      const comparable = previous
        ? {
            outcome: previous.outcome,
            amount: previous.amount,
            currency: previous.currency,
            priceKind: previous.priceKind,
            soldAt: previous.soldAt,
            priceNote: previous.priceNote,
          }
        : null;
      if (JSON.stringify(result) !== JSON.stringify(comparable)) {
        await tx
          .insert(auctionLotResults)
          .values({ lotId: lot.id, ...result, sourceUrl: lot.url, observedAt });
      }
    }
    return { lot, isNew: !existing };
  });
}

export class AuctionLotMatchChangedError extends Error {
  constructor() {
    super(
      "Auction lot identity or assignment changed. Refresh before matching.",
    );
  }
}

/** Bottle locks precede lot locks so assignments and catalog merges share lock order. */
export async function assignAuctionLot({
  lotId,
  bottleId,
  fingerprint,
  expectedBottleId,
  userId,
  checkId,
  referenceName,
  automatic = false,
  rememberReference = false,
  expectedCheckId,
  createBottle,
}: {
  lotId: number;
  fingerprint: string;
  expectedBottleId: number | null;
  userId?: number;
  checkId?: number;
  referenceName?: string;
  automatic?: boolean;
  rememberReference?: boolean;
  expectedCheckId?: number | null;
} & (
  | { bottleId: number; createBottle?: never }
  | { bottleId?: never; createBottle: true; automatic: true; checkId: number }
)) {
  const result = await db.transaction(async (tx) => {
    if (userId !== undefined) {
      const user = await tx.query.users.findFirst({
        where: eq(users.id, userId),
      });
      if (!user || (!user.mod && !user.admin))
        throw new Error("Auction assignment requires a moderator.");
    }
    if (rememberReference && (userId === undefined || expectedCheckId == null))
      throw new AuctionLotMatchChangedError();
    const actor =
      userId === undefined
        ? await getPeatedSystemActorForDatabase(tx)
        : await getUserActorByIdForDatabase(tx, userId);
    let creation: Awaited<
      ReturnType<typeof createOrReuseBottleInTransaction>
    > | null = null;
    if (createBottle) {
      if (!automatic || checkId === undefined || userId !== undefined)
        throw new AuctionLotMatchChangedError();
      const snapshot = await tx.query.auctionLots.findFirst({
        where: eq(auctionLots.id, lotId),
      });
      const savedCheck = await tx.query.bottleChecks.findFirst({
        where: eq(bottleChecks.id, checkId),
      });
      const evidence =
        snapshot && readAuctionMatchEvidence(snapshot, savedCheck);
      if (
        !snapshot ||
        snapshot.sourceFingerprint !== fingerprint ||
        snapshot.bottleId !== null ||
        expectedBottleId !== null ||
        snapshot.matchStatus !== "pending" ||
        snapshot.matchCheckId !== checkId ||
        !savedCheck ||
        evidence?.output.status !== "classified" ||
        evidence.output.decision.action !== "create_bottle" ||
        !assessAuctionMatch(snapshot, savedCheck)?.automationEligible ||
        referenceName ||
        rememberReference
      )
        throw new AuctionLotMatchChangedError();
      // Auction matching creates before locking the lot: all assignment paths lock Bottle first.
      creation = await createOrReuseBottleInTransaction(tx, {
        creationSource: "bottle_classifier",
        createdByActorId: actor.id,
        input: buildClassifierBottleInput(
          evidence.output.decision.proposedBottle,
        ),
      });
      bottleId = creation.bottle.id;
    }
    if (bottleId === undefined) throw new AuctionLotMatchChangedError();
    await resolveActiveBottleIds(tx, [bottleId], {
      lock: rememberReference ? "update" : "share",
    });
    let remembered: BottleReferenceAssignmentResult | null = null;
    let check: BottleCheck | undefined;
    if (rememberReference) {
      const snapshot = await tx.query.auctionLots.findFirst({
        where: eq(auctionLots.id, lotId),
      });
      check =
        expectedCheckId == null
          ? undefined
          : await tx.query.bottleChecks.findFirst({
              where: eq(bottleChecks.id, expectedCheckId),
            });
      const evidence = snapshot && readAuctionMatchEvidence(snapshot, check);
      if (
        !snapshot ||
        snapshot.matchCheckId !== expectedCheckId ||
        !evidence ||
        evidence.output.status !== "classified" ||
        evidence.output.decision.action !== "match" ||
        evidence.output.decision.referenceScope !== "global_alias" ||
        evidence.output.decision.matchedBottleId !== bottleId
      )
        throw new AuctionLotMatchChangedError();
      const auction = await tx.query.auctions.findFirst({
        where: eq(auctions.id, snapshot.auctionId),
      });
      if (!auction) throw new Error("Auction lot has no auction.");
      remembered = await assignBottleReferenceInTransaction(tx, {
        bottleId,
        name: normalizeBottleReferenceKey(snapshot.name),
        externalSiteId: auction.externalSiteId,
        volume: snapshot.volume ?? undefined,
        assignmentSource: "human_approved",
        assignedByActorId: actor.id,
        rejectIgnored: true,
      });
    }
    const [reference] = referenceName
      ? await tx
          .select()
          .from(bottleReferences)
          .where(
            eq(
              sql`LOWER(${bottleReferences.name})`,
              referenceName.toLowerCase(),
            ),
          )
          .for("share")
      : [];
    if (
      referenceName &&
      (!reference || reference.bottleId !== bottleId || reference.ignored)
    )
      throw new AuctionLotMatchChangedError();
    const [lot] = await tx
      .select()
      .from(auctionLots)
      .where(eq(auctionLots.id, lotId))
      .for("update");
    if (
      !lot ||
      lot.sourceFingerprint !== fingerprint ||
      lot.bottleId !== expectedBottleId ||
      (expectedCheckId !== undefined && lot.matchCheckId !== expectedCheckId) ||
      (automatic &&
        (lot.matchStatus !== "pending" || lot.matchCheckId !== checkId))
    )
      throw new AuctionLotMatchChangedError();
    const now = new Date();
    const savedCheckId = checkId ?? lot.matchCheckId;
    if (check?.id !== savedCheckId) {
      check =
        savedCheckId === null
          ? undefined
          : await tx.query.bottleChecks.findFirst({
              where: eq(bottleChecks.id, savedCheckId),
            });
    }
    const evidence = readAuctionMatchEvidence(lot, check);
    if (checkId !== undefined && !evidence)
      throw new AuctionLotMatchChangedError();
    if (automatic) {
      const assessment = check && assessAuctionMatch(lot, check);
      if (
        !assessment?.automationEligible ||
        (createBottle
          ? evidence?.output.status !== "classified" ||
            evidence.output.decision.action !== "create_bottle"
          : assessment.bottleId !== bottleId) ||
        (assessment.referenceName ?? undefined) !== referenceName
      )
        throw new AuctionLotMatchChangedError();
    }
    if (reference || automatic) {
      const bottle = await tx.query.bottles.findFirst({
        where: eq(bottles.id, bottleId),
      });
      if (
        !bottle ||
        getBottleFieldConflicts(lot.sourceBottleIdentity, bottle).length > 0
      )
        throw new AuctionLotMatchChangedError();
    }
    const [updated] = await tx
      .update(auctionLots)
      .set({
        bottleId,
        matchStatus: "matched",
        matchedAt: now,
        matchedById: userId ?? null,
        matchCheckId: checkId ?? lot.matchCheckId,
        matchedReferenceId: reference?.id ?? null,
        availableSince:
          auctionAvailability(lot, now) === "live"
            ? lot.bottleId === bottleId
              ? (lot.availableSince ?? now)
              : now
            : null,
      })
      .where(eq(auctionLots.id, lotId))
      .returning();
    if (lot.bottleId !== bottleId) {
      const auction = await tx.query.auctions.findFirst({
        where: eq(auctions.id, lot.auctionId),
      });
      if (!auction) throw new Error("Auction lot has no auction.");
      const metadata: IncomingBottleDecisionMetadata = {
        resolutionSource: userId === undefined ? "automatic" : "moderator",
        matchingBasis: reference
          ? "accepted_reference"
          : "classifier_or_review",
        referenceScope: rememberReference ? "global_alias" : "none",
        classifierEvidence: check ? { checkId: check.id } : null,
      };
      if (creation) metadata.reusedExistingBottle = !creation.createResult;
      await recordIncomingBottleDecisionInTransaction(tx, {
        sourceKind: "auction_lot",
        sourceId: lot.id,
        externalSiteId: auction.externalSiteId,
        name: lot.name,
        url: lot.url,
        decision: creation?.createResult ? "create_bottle" : "match",
        actor,
        bottleId,
        createdBottle: creation?.createResult != null,
        model: check?.model ?? null,
        rationale:
          evidence?.output.status === "classified"
            ? evidence.output.decision.rationale
            : null,
        metadata,
      });
    }
    return { lot: updated, remembered, creation };
  });
  if (result.creation?.createResult)
    await finalizeCreatedBottle(result.creation.createResult, {
      creationSource: "bottle_classifier",
    });
  // Auction matching owns assignments, not catalog images, even when remembering a name.
  if (result.remembered)
    await finalizeBottleReferenceAssignment({
      ...result.remembered,
      bottleImageCandidate: null,
    });
  return result.lot;
}

/** Alerts own permanent deduplication; the notification and alert are committed together. */
export async function notifyAuctionLot(lotId: number) {
  const snapshot = await db.query.auctionLots.findFirst({
    where: eq(auctionLots.id, lotId),
  });
  if (!snapshot?.bottleId) return 0;
  const bottleId = snapshot.bottleId;
  return db.transaction(async (tx) => {
    await resolveActiveBottleIds(tx, [bottleId]);
    const [lot] = await tx
      .select()
      .from(auctionLots)
      .where(eq(auctionLots.id, lotId))
      .for("update");
    if (
      !lot ||
      !lot.bottleId ||
      lot.bottleId !== snapshot.bottleId ||
      !lot.availableSince ||
      auctionAvailability(lot) !== "live"
    )
      return 0;
    const watches = await tx
      .select()
      .from(auctionWatches)
      .where(
        and(
          eq(auctionWatches.bottleId, lot.bottleId),
          lte(auctionWatches.createdAt, lot.availableSince),
        ),
      )
      .orderBy(auctionWatches.id)
      .for("share");
    let count = 0;
    for (const watch of watches) {
      const [alert] = await tx
        .insert(auctionAlerts)
        .values({ userId: watch.userId, lotId, bottleId: lot.bottleId })
        .onConflictDoNothing()
        .returning();
      if (!alert) continue;
      await tx.insert(notifications).values({
        userId: watch.userId,
        objectId: alert.id,
        type: "auction_available",
        createdAt: alert.createdAt,
      });
      count += 1;
    }
    return count;
  });
}
