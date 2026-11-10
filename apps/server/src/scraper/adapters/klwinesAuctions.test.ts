import { vi } from "vitest";
import type { z } from "zod";
import { ScraperHttpStatusError } from "../http";
import type { ScraperSession } from "../types";
import type {
  KlwinesAuctionListRecord,
  KlwinesAuctionsCursorSchema,
  KlwinesAuctionsObservation,
} from "./klwinesAuctions";
import {
  isKlwinesAuctionLotUrl,
  klwinesAuctionObservation,
  klwinesAuctionsAdapter,
  klwinesSourceBottleIdentity,
  parseKlwinesAuctionList,
  parseKlwinesAuctionLotPage,
} from "./klwinesAuctions";

// Structural fixtures keep only the __NEXT_DATA__ fields read from K&L's
// spirits auction list and lot pages, checked on 2026-11-10.
function record(
  overrides: Partial<KlwinesAuctionListRecord> = {},
): KlwinesAuctionListRecord {
  return {
    sku: "2083520",
    itemName:
      "Old Pulteney Single Cask No. 10110 Cask Strength Highland Single Malt Whisky",
    productType: "Distilled Spirits",
    varietal: "Malt",
    lotItemCount: 1,
    lotVintagePrefix: "1988",
    containerType: "Spirits 750ml",
    imageUrl:
      "https://cdn.klwines.com/auction/15655815/638532/0134368517446949189x.jpg",
    winningBidAmount: 204.1,
    numberBids: 3,
    auctionStartDT: "2026-11-01T17:40:00Z",
    auctionEndDT: "2026-11-14T17:40:00Z",
    originalAuctionEndDT: null,
    auctionStatus: "Active",
    ...overrides,
  };
}

function nextData(queries: { queryKey: unknown[]; data: unknown }[]) {
  return `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
    {
      props: {
        pageProps: {
          dehydratedState: {
            queries: queries.map(({ queryKey, data }) => ({
              queryKey,
              state: { data },
            })),
          },
        },
      },
    },
  )}</script></body></html>`;
}

function listPage(records: KlwinesAuctionListRecord[], total = records.length) {
  return nextData([
    { queryKey: ["GetUserStatus"], data: {} },
    {
      queryKey: ["product-search", "{}", "/auctions", "public"],
      data: {
        records: records.map((value) => ({ score: 0, record: value })),
        totalRecordsFound: total,
      },
    },
  ]);
}

function lotPage(
  sku: number,
  item: Partial<{
    Quantity: number;
    BottleSize: string;
    Condition: string;
  }> = {},
  items = 1,
) {
  return nextData([
    {
      queryKey: ["GetAuctionContext"],
      data: {
        Lot: {
          SKU: sku,
          LotName: "Example lot",
          LotDescription: "Bid on this bottle.",
          LotItems: Array.from({ length: items }, () => ({
            ItemName: "Example",
            Quantity: 1,
            BottleSize: "750 ml",
            Condition: "Original box. Bottled 2016. 112.4 Proof.",
            Provenance: "Private cellar.",
            AdditionalNotes: "",
            ...item,
          })),
        },
      },
    },
  ]);
}

const observedAt = new Date("2026-11-10T04:00:00Z");

test("groups lots by their original Pacific closing day, not a late-bid end", () => {
  const extended = klwinesAuctionObservation(
    record({
      auctionEndDT: "2026-11-01T07:02:00Z",
      originalAuctionEndDT: "2026-11-01T06:55:00Z",
    }),
    null,
    observedAt,
  );
  // 2026-11-01T06:55Z is 11:55 PM on October 31 in Los Angeles.
  expect(extended.auction).toMatchObject({
    sourceKey: "2026-10-31",
    name: "K&L Spirits Auction ending October 31, 2026",
  });
  expect(extended.lot.endsAt).toBe("2026-11-01T07:02:00Z");
});

test("uses the SKU as the lot key and keeps K&L's vintage prefix in the name", () => {
  const { lot } = klwinesAuctionObservation(record(), null, observedAt);
  expect(lot).toMatchObject({
    sourceKey: "2083520",
    name: "1988 Old Pulteney Single Cask No. 10110 Cask Strength Highland Single Malt Whisky",
    url: "https://www.klwines.com/auctions/bidding/2083520",
    state: "live",
    currentBid: 20410,
    bidCurrency: "usd",
  });
  expect(
    klwinesAuctionObservation(record({ lotVintagePrefix: "NV" }), null).lot
      .name,
  ).not.toMatch(/^NV /);
});

test("records a hammer price only for a completed order with bids", () => {
  const sold = klwinesAuctionObservation(
    record({ auctionStatus: "Order_Complete", winningBidAmount: 180 }),
    null,
    observedAt,
  ).lot;
  expect(sold).toMatchObject({
    state: "closed",
    result: {
      outcome: "sold",
      amount: 18000,
      currency: "usd",
      priceKind: "hammer",
      soldAt: "2026-11-14T17:40:00Z",
    },
  });
  expect(sold.currentBid).toBeUndefined();

  // An unsold lot lists its starting price as the winning bid.
  const unsold = klwinesAuctionObservation(
    record({
      auctionStatus: "Ended_No_Win",
      winningBidAmount: 150,
      numberBids: 0,
    }),
    null,
    observedAt,
  ).lot;
  expect(unsold.result).toMatchObject({
    outcome: "unsold",
    amount: null,
    currency: null,
    priceKind: null,
    soldAt: null,
  });

  const open = klwinesAuctionObservation(
    record({ numberBids: 0, winningBidAmount: 95 }),
    null,
    observedAt,
  ).lot;
  expect(open.currentBid).toBeUndefined();
  expect(open.result).toBeUndefined();
  expect(
    klwinesAuctionObservation(record({ auctionStatus: "Withdrawn" }), null).lot
      .state,
  ).toBe("unknown");
});

test("reads volume, condition, proof, and bottling year from the lot page", () => {
  const page = parseKlwinesAuctionLotPage(lotPage(2083520), "2083520");
  const { lot } = klwinesAuctionObservation(record(), page, observedAt);
  expect(lot).toMatchObject({
    volume: 750,
    condition: "Original box. Bottled 2016. 112.4 Proof.",
    sourceBottleIdentity: { abv: 56.2, bottling_year: 2016 },
  });
  expect(() => parseKlwinesAuctionLotPage(lotPage(1), "2083520")).toThrow(
    "another lot",
  );
});

test("leaves stated facts unknown when the note is missing or conflicts", () => {
  expect(klwinesSourceBottleIdentity(null)).toBeNull();
  expect(klwinesSourceBottleIdentity("Original box.")).toBeNull();
  expect(
    klwinesSourceBottleIdentity("One at 100 proof, one at 114 proof."),
  ).toBeNull();
  expect(klwinesSourceBottleIdentity("Bottled 2024. 119 Proof.")).toMatchObject(
    {
      abv: 59.5,
      bottling_year: 2024,
    },
  );
});

test("reads list records and accepts only K&L lot pages", () => {
  expect(parseKlwinesAuctionList(listPage([record()], 1195))).toMatchObject({
    total: 1195,
    records: [{ sku: "2083520" }],
  });
  expect(() => parseKlwinesAuctionList("<html></html>")).toThrow();
  expect(
    isKlwinesAuctionLotUrl("https://www.klwines.com/auctions/bidding/2083520"),
  ).toBe(true);
  expect(
    isKlwinesAuctionLotUrl("https://shop.klwines.com/auctions/bidding/2083520"),
  ).toBe(false);
  expect(
    isKlwinesAuctionLotUrl("https://www.klwines.com/products/details/2083520"),
  ).toBe(false);
});

type Session = ScraperSession<
  z.infer<typeof KlwinesAuctionsCursorSchema>,
  KlwinesAuctionsObservation
>;

function response(url: URL, body: string) {
  return { url, status: 200, headers: {}, body };
}

test("reads only single-bottle whisky lot pages and saves its place after each", async () => {
  const emit = vi.fn<Session["emit"]>();
  const checkpoint = vi.fn<Session["checkpoint"]>();
  const request = vi.fn<Session["request"]>(async ({ url }) => {
    if (url.pathname === "/products/auctions")
      return response(
        url,
        listPage([
          record({ sku: "1" }),
          record({ sku: "2", varietal: "Tequila" }),
          record({ sku: "3", lotItemCount: 4 }),
          record({ sku: "4" }),
          record({ sku: "5" }),
        ]),
      );
    const sku = url.pathname.split("/").at(-1)!;
    if (sku === "4") return response(url, lotPage(4, {}, 2));
    if (sku === "5") throw new ScraperHttpStatusError(404, url, {});
    return response(url, lotPage(Number(sku)));
  });
  await klwinesAuctionsAdapter({
    cursor: null,
    session: { request, emit, checkpoint, remainingRequests: () => 100 },
  });
  // One list page, then lot pages for the three whisky single-bottle records.
  expect(request.mock.calls.map(([input]) => input.url.pathname)).toEqual([
    "/products/auctions",
    "/auctions/bidding/1",
    "/auctions/bidding/4",
    "/auctions/bidding/5",
  ]);
  // The two-item lot is skipped; the removed page keeps the list's facts.
  expect(emit.mock.calls.map(([input]) => input.sourceKey)).toEqual([
    "lot:1",
    "lot:5",
  ]);
  expect(emit.mock.calls[1][0].value[0].lot.volume).toBeUndefined();
  expect(checkpoint.mock.calls.map(([state]) => state)).toEqual([
    { page: 1, recordIndex: 1 },
    { page: 1, recordIndex: 4 },
    { page: 1, recordIndex: 5 },
  ]);
});

test("resumes mid-page and stops at the last listed page", async () => {
  const emit = vi.fn<Session["emit"]>();
  const checkpoint = vi.fn<Session["checkpoint"]>();
  const records = Array.from({ length: 48 }, (_, index) =>
    record({ sku: String(index + 1), varietal: "Rum" }),
  );
  records[47] = record({ sku: "48" });
  const request = vi.fn<Session["request"]>(async ({ url }) => {
    if (url.pathname === "/products/auctions")
      return response(
        url,
        url.searchParams.has("page")
          ? listPage([record({ sku: "49" })], 49)
          : listPage(records, 49),
      );
    return response(url, lotPage(Number(url.pathname.split("/").at(-1))));
  });
  await klwinesAuctionsAdapter({
    cursor: { page: 1, recordIndex: 47 },
    session: { request, emit, checkpoint, remainingRequests: () => 100 },
  });
  expect(emit.mock.calls.map(([input]) => input.sourceKey)).toEqual([
    "lot:48",
    "lot:49",
  ]);
  expect(request).toHaveBeenCalledTimes(4);
  expect(checkpoint.mock.calls.at(-1)?.[0]).toEqual({
    page: 2,
    recordIndex: 1,
  });
});
