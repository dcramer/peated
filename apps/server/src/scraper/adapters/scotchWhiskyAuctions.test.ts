import { vi } from "vitest";
import type { z } from "zod";
import type { ScraperSession } from "../types";
import type {
  ScotchWhiskyAuctionsCursorSchema,
  ScotchWhiskyAuctionsObservation,
} from "./scotchWhiskyAuctions";
import {
  ScotchWhiskyAuctionsCursorSchema as CursorSchema,
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

test("retains the exact published photo link without inventing a larger image URL", () => {
  const imageUrl =
    "https://d3suvtcq00dftb.cloudfront.net/images/3245b62843e278810e3789a39f58a216-med.jpg";
  const html = page("Sold for £240").replace(
    "<h4>",
    `<div class="aucimg hasretina" style="background-image: url('${imageUrl}');" rel="orig224"></div><h4>`,
  );
  expect(
    parseScotchWhiskyAuctionPage(html, auction).items[0].lot,
  ).toMatchObject({
    imageUrl,
    result: { amount: 24000 },
  });
  expect(
    parseScotchWhiskyAuctionPage(
      html.replace(imageUrl, "/images/example-med.jpg"),
      auction,
    ).items[0].lot.imageUrl,
  ).toBe("https://www.scotchwhiskyauctions.com/images/example-med.jpg");
});

test.each([
  "",
  "background-image: none;",
  "background-image: url('https://example.com/other-site.jpg');",
  "background-image: url('javascript:alert(1)');",
  "background-image: url('http://d3suvtcq00dftb.cloudfront.net/image.jpg');",
  "background-image: url('https://user:password@d3suvtcq00dftb.cloudfront.net/image.jpg');",
])("ignores missing or unsupported photo links: %s", (style) => {
  const html = page("Sold for £240").replace(
    "<h4>",
    `<div class="aucimg" style="${style}"></div><h4>`,
  );
  const lot = parseScotchWhiskyAuctionPage(html, auction).items[0].lot;
  expect(lot.imageUrl).toBeUndefined();
  expect(lot.result?.amount).toBe(24000);
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

test("an unmet reserve during bidding is not a final unsold result", () => {
  const lot = parseScotchWhiskyAuctionPage(
    page("Current highest bid: £90 Reserve not met", "Ends October 11, 2026"),
    auction,
  ).items[0].lot;
  expect(lot).toMatchObject({ state: "live", currentBid: 9000 });
  expect(lot.result).toBeUndefined();
});

test("scheduled discovery follows open headings rather than link position", () => {
  const html = `<div class="auctions">
    <a class="auction" href="/auctions/232-the-183rd-auction/"><h4>The 183rd Auction</h4><h5>Ended September 13, 2026</h5></a>
    <a class="auction" href="/auctions/233-the-184th-auction/"><h4>The 184th Auction</h4><h5>Ends October 11, 2026</h5></a>
    <a class="auction" href="/auctions/231-the-182nd-auction/"><h4>The 182nd Auction</h4><h5>Ended August 9, 2026</h5></a>
  </div>`;
  expect(
    parseScotchWhiskyAuctionsIndex(html, "current").map((a) => a.sourceKey),
  ).toEqual(["233"]);
  expect(parseScotchWhiskyAuctionsIndex(html).map((a) => a.sourceKey)).toEqual([
    "232",
    "233",
  ]);
  expect(
    parseScotchWhiskyAuctionsIndex(
      html.replace("Ends October 11, 2026", "Ended October 11, 2026"),
      "current",
    ).map((a) => a.sourceKey),
  ).toEqual(["233"]);
  expect(() =>
    parseScotchWhiskyAuctionsIndex(
      html.replace("Ends October", "Ended October").replaceAll(", 2026", ""),
      "current",
    ),
  ).toThrow(/recognized auction states/);
  expect(() =>
    parseScotchWhiskyAuctionsIndex(
      '<div class="auctions"><a class="auction" href="/auctions/232-the-183rd-auction/"><h4>The 183rd Auction</h4><h5>Ended 7th June</h5></a></div>',
      "current",
    ),
  ).toThrow(/recognized auction states/);
  expect(() =>
    parseScotchWhiskyAuctionsIndex(
      html.replace(/<h5>.*?<\/h5>/g, ""),
      "current",
    ),
  ).toThrow(/recognized auction states/);
  expect(
    CursorSchema.parse({ auctions: [auction], auctionIndex: 0, page: 2 }),
  ).toMatchObject({ scope: "recent", page: 2 });
});

test("current collection discovers once and checkpoints the same scope for pagination", async () => {
  const emit = vi.fn();
  const checkpoint = vi.fn();
  const request = vi
    .fn()
    .mockResolvedValueOnce({
      body: `<div class="auctions"><a class="auction" href="/auctions/232-the-183rd-auction/"><h4>Auction</h4><h5>Ends October 11, 2026</h5></a></div>`,
    })
    .mockResolvedValueOnce({
      body: page("Current highest bid: £90", "Ends October 11, 2026"),
    });
  await scotchWhiskyAuctionsAdapter({
    cursor: { scope: "current", auctions: [], auctionIndex: 0, page: 1 },
    session: { request, emit, checkpoint, remainingRequests: () => 100 },
  });
  expect(request).toHaveBeenCalledTimes(2);
  expect(checkpoint.mock.calls[0][0]).toMatchObject({
    scope: "current",
    auctionIndex: 0,
  });
  expect(emit.mock.calls[0][0].value[0].lot).toMatchObject({
    state: "live",
    currentBid: 9000,
  });
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
        ScotchWhiskyAuctionsObservation
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
    ScotchWhiskyAuctionsObservation
  > = {
    request,
    emit,
    checkpoint,
    remainingRequests: () => 100,
  };
  await scotchWhiskyAuctionsAdapter({
    cursor: { scope: "recent", auctions: [auction], auctionIndex: 0, page: 1 },
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
