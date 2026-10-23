import { expect, test } from "vitest";
import { auctionLotAssignment } from "./auctionTask";

const item = {
  lot: { id: 7, bottleId: null },
  fingerprint: "observed-version",
  matchCheckId: 21,
  suggestedBottle: { id: 42 },
  canRememberReference: true,
};

test("lot-only and remembered actions both send the observed source and check versions", () => {
  expect(auctionLotAssignment(item, 42)).toEqual({
    lot: 7,
    bottleId: 42,
    fingerprint: "observed-version",
    expectedBottleId: null,
    expectedCheckId: 21,
    rememberReference: false,
  });
  expect(auctionLotAssignment(item, 42, true)).toMatchObject({
    expectedCheckId: 21,
    rememberReference: true,
  });
  expect(auctionLotAssignment(item, 99)).toMatchObject({
    bottleId: 99,
    rememberReference: false,
  });
});

test("a different bottle or unavailable reuse scope cannot request name acceptance", () => {
  expect(() => auctionLotAssignment(item, 99, true)).toThrow(
    /suggested bottle/,
  );
  expect(() =>
    auctionLotAssignment({ ...item, canRememberReference: false }, 42, true),
  ).toThrow(/suggested bottle/);
});
