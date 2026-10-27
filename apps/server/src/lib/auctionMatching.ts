import { type ClassifyBottleReferenceInput } from "@peated/bottle-classifier/contract";
import { getBottleFieldConflicts } from "@peated/bottle-classifier/fieldConflicts";
import { normalizeBottleReferenceKey } from "@peated/bottle-classifier/normalize";
import { runScrapedBottleReference } from "@peated/server/agents/bottleClassifier/scrapedBottleReference";
import { db, type AnyDatabase } from "@peated/server/db";
import {
  auctionLots,
  auctions,
  bottleChecks,
  bottles,
  type AuctionLot,
  type BottleCheck,
} from "@peated/server/db/schema";
import { requestAuctionLotDetails } from "@peated/server/scraper";
import { pushJob } from "@peated/server/worker/dispatch";
import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import {
  assessAuctionMatch,
  auctionLotCheckKey,
  readAuctionMatchEvidence,
} from "./auctionMatchEvidence";
import {
  assignAuctionLot,
  AuctionLotMatchChangedError,
  isMiniatureAuctionLot,
} from "./auctions";
import { createBottleCheck } from "./bottleChecks";
import { findBottleReferenceAssignment } from "./bottleFinder";
import { BottleAlreadyExistsError } from "./createBottle";
import { ActiveBottleSelectionError } from "./resolveActiveBottleIds";

/** Reuse accepted decisions first; the shared Bottle rules assess new matches and creation. */
export async function resolveAuctionLot(lotId: number, fingerprint: string) {
  await resolveAuctionLotMatch(lotId, fingerprint, true);
}

/** Auction worker rule: return false when model work is needed; never run it here. */
export async function applySavedAuctionLotMatch(
  lotId: number,
  fingerprint: string,
) {
  return resolveAuctionLotMatch(lotId, fingerprint, false);
}

async function resolveAuctionLotMatch(
  lotId: number,
  fingerprint: string,
  allowClassification: boolean,
) {
  let lot = await db.query.auctionLots.findFirst({
    where: eq(auctionLots.id, lotId),
  });
  if (
    !lot ||
    lot.sourceFingerprint !== fingerprint ||
    lot.matchStatus !== "pending"
  )
    return true;
  // Auction scope rule: ignore miniatures before any reference, detail read, or model call.
  if (isMiniatureAuctionLot(lot)) {
    await db
      .update(auctionLots)
      .set({ matchStatus: "ignored" })
      .where(
        and(
          eq(auctionLots.id, lotId),
          eq(auctionLots.sourceFingerprint, fingerprint),
          eq(auctionLots.matchStatus, "pending"),
          isNull(auctionLots.bottleId),
        ),
      );
    return true;
  }
  const reference = await findBottleReferenceAssignment(
    normalizeBottleReferenceKey(lot.name),
  );
  if (reference) {
    const bottle = await db.query.bottles.findFirst({
      where: eq(bottles.id, reference.bottleId),
    });
    if (
      bottle &&
      !getBottleFieldConflicts(lot.sourceBottleIdentity, bottle).length
    ) {
      try {
        await assignAuctionLot({
          lotId,
          bottleId: bottle.id,
          fingerprint,
          expectedBottleId: null,
          referenceName: reference.reference.name,
        });
        return true;
      } catch (error) {
        if (
          !(error instanceof AuctionLotMatchChangedError) &&
          !(error instanceof ActiveBottleSelectionError)
        )
          throw error;
        const current = await db.query.auctionLots.findFirst({
          where: eq(auctionLots.id, lotId),
        });
        if (
          !current ||
          current.sourceFingerprint !== fingerprint ||
          current.matchStatus !== "pending" ||
          current.bottleId !== null
        )
          return true;
      }
    }
  }
  const backgroundEventKey = auctionLotCheckKey(lot.id, fingerprint);
  let check = await db.query.bottleChecks.findFirst({
    where: eq(bottleChecks.backgroundEventKey, backgroundEventKey),
  });
  if (!check) {
    // Auction matching collects listing facts before the first model call.
    if (
      !lot.sourceBottleIdentity &&
      (await requestAuctionLotDetails(lotId, fingerprint))
    )
      return true;
    const shared = await findSharedAuctionLotCheck(lot, fingerprint);
    if (shared === "wait") return true;
    if (shared) return applyAuctionLotCheck(lotId, fingerprint, shared);
    if (!allowClassification) return false;
    const auction = await db.query.auctions.findFirst({
      where: eq(auctions.id, lot.auctionId),
    });
    if (!auction) throw new Error("Auction lot has no auction.");
    // Auction matching skips changed lots before a model call and checks again when saving.
    lot = await db.query.auctionLots.findFirst({
      where: and(
        eq(auctionLots.id, lotId),
        eq(auctionLots.sourceFingerprint, fingerprint),
        eq(auctionLots.matchStatus, "pending"),
        isNull(auctionLots.bottleId),
      ),
    });
    if (!lot) return true;
    // Auction matching uses listing text and facts; photos remain review links.
    const input: ClassifyBottleReferenceInput = {
      readCandidateImages: false,
      reference: {
        id: lot.id,
        externalSiteId: auction.externalSiteId,
        name: lot.name,
        url: lot.url,
        imageUrl: null,
        currentBottleId: null,
      },
    };
    if (lot.sourceBottleIdentity) {
      input.extractedIdentity = lot.sourceBottleIdentity;
      input.extractedIdentitySource = "structured";
    }
    const run = await runScrapedBottleReference(input);
    const classifiedLot = lot;
    check = await db.transaction(async (tx) => {
      // Auction matching rule (owner: auctions): the first saved check for an
      // identity wins. A twin that became identical while this lot was being
      // classified may have saved one first; reuse it so only one decision
      // applies, and drop this run's result, which had the same input.
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${`auction-lot-identity:${auction.externalSiteId}:${fingerprint}`}))`,
      );
      const shared = await findSharedAuctionLotCheck(
        classifiedLot,
        fingerprint,
        tx,
      );
      if (shared && shared !== "wait") return shared;
      return (
        await createBottleCheck(
          {
            intent: "resolve_reference",
            sourceKind: "auction_lot",
            sourceId: classifiedLot.id,
            input,
            result: run.result,
            modelMetadata: run.modelMetadata,
            backgroundEventKey,
          },
          tx,
        )
      ).check;
    });
    await applyAuctionLotCheck(lotId, fingerprint, check);
    await queueIdenticalAuctionLots(lot, fingerprint);
    return true;
  }
  return applyAuctionLotCheck(lotId, fingerprint, check);
}

/**
 * Auction matching rule (owner: auctions): lots on one site with the same
 * identity fingerprint get the same classifier input, so they share one check.
 * The earliest pending lot runs the model; identical lots wait and reuse its
 * decision, so they never race to create duplicate Bottles.
 */
async function findSharedAuctionLotCheck(
  lot: AuctionLot,
  fingerprint: string,
  database: AnyDatabase = db,
) {
  const twins = await findIdenticalAuctionLots(lot, fingerprint, database);
  if (!twins.length) return null;
  const [shared] = await database
    .select()
    .from(bottleChecks)
    .where(
      inArray(
        bottleChecks.backgroundEventKey,
        twins.map(({ id }) => auctionLotCheckKey(id, fingerprint)),
      ),
    )
    .orderBy(asc(bottleChecks.id))
    .limit(1);
  if (shared) return shared;
  return twins.some(
    ({ id, matchStatus }) => id < lot.id && matchStatus === "pending",
  )
    ? ("wait" as const)
    : null;
}

async function findIdenticalAuctionLots(
  lot: AuctionLot,
  fingerprint: string,
  database: AnyDatabase = db,
) {
  const auction = await database.query.auctions.findFirst({
    where: eq(auctions.id, lot.auctionId),
  });
  if (!auction) throw new Error("Auction lot has no auction.");
  return database
    .select({ id: auctionLots.id, matchStatus: auctionLots.matchStatus })
    .from(auctionLots)
    .innerJoin(auctions, eq(auctions.id, auctionLots.auctionId))
    .where(
      and(
        eq(auctionLots.sourceFingerprint, fingerprint),
        eq(auctions.externalSiteId, auction.externalSiteId),
        ne(auctionLots.id, lot.id),
      ),
    );
}

/** Identical lots that waited for this check reuse it on the default queue. */
async function queueIdenticalAuctionLots(lot: AuctionLot, fingerprint: string) {
  const twins = await findIdenticalAuctionLots(lot, fingerprint);
  for (const { id, matchStatus } of twins) {
    if (matchStatus !== "pending") continue;
    await pushJob("ApplyAuctionLotMatch", { lotId: id, fingerprint });
  }
}

async function applyAuctionLotCheck(
  lotId: number,
  fingerprint: string,
  check: BottleCheck,
) {
  const [current] = await db
    .update(auctionLots)
    .set({ matchCheckId: check.id })
    .where(
      and(
        eq(auctionLots.id, lotId),
        eq(auctionLots.sourceFingerprint, fingerprint),
        eq(auctionLots.matchStatus, "pending"),
        isNull(auctionLots.bottleId),
      ),
    )
    .returning();
  if (!current) return true;
  const assessment = assessAuctionMatch(current, check);
  if (assessment?.automationEligible) {
    try {
      await assignAuctionLot({
        lotId,
        ...(assessment.bottleId !== null
          ? { bottleId: assessment.bottleId }
          : { createBottle: true as const }),
        fingerprint,
        expectedBottleId: null,
        checkId: check.id,
        automatic: true as const,
        referenceName: assessment.referenceName ?? undefined,
      });
      return true;
    } catch (error) {
      if (
        !(error instanceof AuctionLotMatchChangedError) &&
        !(error instanceof ActiveBottleSelectionError) &&
        !(error instanceof BottleAlreadyExistsError)
      )
        throw error;
    }
  }
  const evidence = readAuctionMatchEvidence(current, check);
  await db
    .update(auctionLots)
    .set({
      matchCheckId: check.id,
      matchStatus: evidence?.output.status === "ignored" ? "ignored" : "review",
    })
    .where(
      and(
        eq(auctionLots.id, lotId),
        eq(auctionLots.sourceFingerprint, fingerprint),
        eq(auctionLots.matchStatus, "pending"),
        eq(auctionLots.matchCheckId, check.id),
        isNull(auctionLots.bottleId),
      ),
    );
  await requestAuctionLotDetails(lotId, fingerprint);
  return true;
}
