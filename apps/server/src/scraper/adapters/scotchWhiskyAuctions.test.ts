import type { AuctionObservation } from "@peated/server/schemas/auctions";
import { vi } from "vitest";
import type { z } from "zod";
import type { ScraperSession } from "../types";
import type { ScotchWhiskyAuctionsCursorSchema } from "./scotchWhiskyAuctions";
import {
  parseScotchWhiskyAuctionPage,
  parseScotchWhiskyAuctionsIndex,
  scotchWhiskyAuctionsAdapter,
} from "./scotchWhiskyAuctions";

const auction = {
  sourceKey: "232",
  name: "The 183rd auction",
  url: "https://www.scotchwhiskyauctions.com/auctions/232-the-183rd-auction/",
};
// Structural fixtures retain only the public selectors checked on 2026-09-30.
function page(info: string, heading = "Ended September 13, 2026", next = "") {
  return `<div id="lotswrap"><h3>${heading}</h3><div id="lots"><a class="lot" href="/auctions/232-the-183rd-auction/897061-example-12-year-old/"><h4>Example 12 Year Old 70cl</h4><h6>Lot no 183-03264</h6><div id="info_897061"><p>${info}</p></div></a></div>${next}</div>`;
}

test("reads event and lot IDs separately and explicit sold prices in minor units", () => {
  const parsed = parseScotchWhiskyAuctionPage(
    page("Sold for £1,240 in September 2026"),
    auction,
  );
  expect(parsed.items[0].lot).toMatchObject({
    sourceKey: "897061",
    lotNumber: "183-03264",
    volume: 700,
    state: "closed",
    result: {
      outcome: "sold",
      amount: 124000,
      priceKind: "hammer",
      soldAt: null,
    },
  });
  expect(parsed.nextPage).toBeNull();
});

test("an ended auction or bid alone does not prove a sale", () => {
  const parsed = parseScotchWhiskyAuctionPage(
    page("Winning bid: £90"),
    auction,
  );
  expect(parsed.items[0].lot.state).toBe("closed");
  expect(parsed.items[0].lot.result).toBeUndefined();
});

test("an explicitly open auction includes lots with no bid yet", () => {
  const parsed = parseScotchWhiskyAuctionPage(
    page("", "Ends October 10, 2026"),
    auction,
  );
  expect(parsed.items[0].lot.state).toBe("live");
  expect(parsed.items[0].lot.currentBid).toBeUndefined();
  expect(parsed.items[0].lot.result).toBeUndefined();
});

test("preserves unknown state, explicit unsold outcomes, and skips explicit sets", () => {
  expect(
    parseScotchWhiskyAuctionPage(page("", "Auction"), auction).items[0].lot
      .state,
  ).toBe("unknown");
  expect(
    parseScotchWhiskyAuctionPage(page("Reserve not met"), auction).items[0].lot
      .result?.outcome,
  ).toBe("unsold");
  expect(
    parseScotchWhiskyAuctionPage(
      page("Sold for £90").replace(
        "Example 12 Year Old 70cl",
        "Example 2 bottles",
      ),
      auction,
    ).items,
  ).toHaveLength(0);
  expect(() => parseScotchWhiskyAuctionPage("<html></html>", auction)).toThrow(
    "index is missing",
  );
});

test("pagination remains complete and resumes without replaying discovery", async () => {
  const emit = vi.fn();
  const checkpoint = vi.fn();
  const request = vi
    .fn<
      ScraperSession<
        z.infer<typeof ScotchWhiskyAuctionsCursorSchema>,
        AuctionObservation[]
      >["request"]
    >()
    .mockResolvedValueOnce({
      url: new URL(auction.url),
      status: 200,
      headers: {},
      body: page(
        "Sold for £90",
        undefined,
        '<input id="nextpage" data-value="2">',
      ),
    })
    .mockResolvedValueOnce({
      url: new URL(auction.url),
      status: 200,
      headers: {},
      body: page("Unsold"),
    });
  const session: ScraperSession<
    z.infer<typeof ScotchWhiskyAuctionsCursorSchema>,
    AuctionObservation[]
  > = {
    request,
    emit,
    checkpoint,
    remainingRequests: () => 100,
  };
  await scotchWhiskyAuctionsAdapter({
    cursor: { auctions: [auction], auctionIndex: 0, page: 1 },
    session,
  });
  expect(request).toHaveBeenCalledTimes(2);
  expect(request.mock.calls[1][0].url.searchParams.get("page")).toBe("2");
  expect(emit).toHaveBeenCalledTimes(2);
  expect(checkpoint.mock.calls.at(-1)?.[0]).toMatchObject({
    auctionIndex: 1,
    page: 1,
  });
});

test("discovery rejects external origins and does not import the full archive", () => {
  const tile = `<a class="auction" href="/auctions/232-the-183rd-auction/"><h4>The 183rd auction</h4></a>`;
  expect(
    parseScotchWhiskyAuctionsIndex(
      `<div class="auctions">${tile.repeat(3)}</div>`,
    ),
  ).toHaveLength(2);
  expect(() =>
    parseScotchWhiskyAuctionsIndex(
      `<div class="auctions">${tile.replace("/auctions/232-the-183rd-auction/", "https://example.com/auctions/232-other/")}</div>`,
    ),
  ).toThrow();
});
