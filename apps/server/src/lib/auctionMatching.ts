import {
  isIgnoredBottleClassification,
  type ClassifyBottleReferenceInput,
} from "@peated/bottle-classifier/contract";
import { normalizeBottleReferenceKey } from "@peated/bottle-classifier/normalize";
import { runScrapedBottleReference } from "@peated/server/agents/bottleClassifier/scrapedBottleReference";
import { db } from "@peated/server/db";
import {
  auctionLots,
  auctions,
  bottleChecks,
  bottles,
} from "@peated/server/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import {
  assignAuctionLot,
  AuctionLotMatchChangedError,
  hasAuctionIdentityConflict,
} from "./auctions";
import { createBottleCheck } from "./bottleChecks";
import { findBottleReferenceAssignment } from "./bottleFinder";
import { ActiveBottleSelectionError } from "./resolveActiveBottleIds";

/** Auction matching reuses accepted references; new classifier suggestions remain reviewable. */
export async function resolveAuctionLot(lotId: number, fingerprint: string) {
  const lot = await db.query.auctionLots.findFirst({
    where: eq(auctionLots.id, lotId),
  });
  if (
    !lot ||
    lot.sourceFingerprint !== fingerprint ||
    lot.matchStatus !== "pending"
  )
    return;
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
        return;
      } catch (error) {
        if (error instanceof AuctionLotMatchChangedError) return;
        if (!(error instanceof ActiveBottleSelectionError)) throw error;
      }
    }
  }
  const auction = await db.query.auctions.findFirst({
    where: eq(auctions.id, lot.auctionId),
  });
  if (!auction) throw new Error("Auction lot has no auction.");
  const input: ClassifyBottleReferenceInput = {
    reference: {
      id: lot.id,
      externalSiteId: auction.externalSiteId,
      name: lot.name,
      url: lot.url,
      imageUrl: lot.imageUrl,
      currentBottleId: null,
    },
  };
  if (lot.sourceBottleIdentity) {
    input.extractedIdentity = lot.sourceBottleIdentity;
    input.extractedIdentitySource = "structured";
  }
  const backgroundEventKey = `auction-lot:${lot.id}:${fingerprint}`;
  let check = await db.query.bottleChecks.findFirst({
    where: eq(bottleChecks.backgroundEventKey, backgroundEventKey),
  });
  if (!check) {
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
    await db
      .update(auctionLots)
      .set({
        matchCheckId: check.id,
        matchStatus: isIgnoredBottleClassification(run.result)
          ? "ignored"
          : "review",
      })
      .where(
        and(
          eq(auctionLots.id, lotId),
          eq(auctionLots.sourceFingerprint, fingerprint),
          eq(auctionLots.matchStatus, "pending"),
          isNull(auctionLots.bottleId),
        ),
      );
    return;
  }
  await db
    .update(auctionLots)
    .set({
      matchCheckId: check.id,
      matchStatus: check.output?.status === "ignored" ? "ignored" : "review",
    })
    .where(
      and(
        eq(auctionLots.id, lotId),
        eq(auctionLots.sourceFingerprint, fingerprint),
        eq(auctionLots.matchStatus, "pending"),
        isNull(auctionLots.bottleId),
      ),
    );
}
