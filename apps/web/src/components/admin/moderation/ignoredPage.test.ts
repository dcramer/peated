import { expect, test } from "vitest";
import {
  auctionLotReopenInput,
  listingReopenInput,
} from "./ignoredPage.stylex";

test("reopening a listing sends the proposal and source versions it read", () => {
  expect(
    listingReopenInput(12, {
      updatedAt: "2026-11-04T18:20:00.000Z",
      price: { sourceFingerprint: "observed-source" },
    }),
  ).toEqual({
    proposal: 12,
    expectedUpdatedAt: "2026-11-04T18:20:00.000Z",
    expectedSourceFingerprint: "observed-source",
  });
});

test("reopening an auction lot sends the source and check versions it read", () => {
  expect(
    auctionLotReopenInput(7, {
      fingerprint: "observed-version",
      matchCheckId: 21,
    }),
  ).toEqual({ lot: 7, fingerprint: "observed-version", expectedCheckId: 21 });
});
