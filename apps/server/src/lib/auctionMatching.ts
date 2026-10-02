import { type ClassifyBottleReferenceInput } from "@peated/bottle-classifier/contract";
import { normalizeBottleReferenceKey } from "@peated/bottle-classifier/normalize";
import { runScrapedBottleReference } from "@peated/server/agents/bottleClassifier/scrapedBottleReference";
import { db } from "@peated/server/db";
import {
  auctionLots,
  auctions,
  bottleChecks,
  bottles,
} from "@peated/server/db/schema";
import { requestAuctionLotDetails } from "@peated/server/scraper";
import { and, eq, isNull } from "drizzle-orm";
import {
  assessAuctionMatch,
  auctionLotCheckKey,
  readAuctionMatchEvidence,
} from "./auctionMatchEvidence";
import {
  assignAuctionLot,
  AuctionLotMatchChangedError,
  hasAuctionIdentityConflict,
} from "./auctions";
import { createBottleCheck } from "./bottleChecks";
import { findBottleReferenceAssignment } from "./bottleFinder";
import { ActiveBottleSelectionError } from "./resolveActiveBottleIds";

/** Reuse accepted decisions first; only evidence-backed existing-Bottle matches may apply automatically. */
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
  const reference = await findBottleReferenceAssignment(
    normalizeBottleReferenceKey(lot.name),
  );
  if (reference) {
    const bottle = await db.query.bottles.findFirst({
      where: eq(bottles.id, reference.bottleId),
    });
    if (
      bottle &&
      !hasAuctionIdentityConflict(lot.sourceBottleIdentity, bottle)
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
    check = (
      await createBottleCheck({
        intent: "resolve_reference",
        sourceKind: "auction_lot",
        sourceId: lot.id,
        input,
        result: run.result,
        modelMetadata: run.modelMetadata,
        backgroundEventKey,
      })
    ).check;
  }
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
  if (assessment?.automationEligible && assessment.bottleId !== null) {
    try {
      await assignAuctionLot({
        lotId,
        bottleId: assessment.bottleId,
        fingerprint,
        expectedBottleId: null,
        checkId: check.id,
        automatic: true,
        referenceName: assessment.referenceName ?? undefined,
      });
      return true;
    } catch (error) {
      if (
        !(error instanceof AuctionLotMatchChangedError) &&
        !(error instanceof ActiveBottleSelectionError)
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
