import type { Outputs } from "@peated/server/orpc/router";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { BottleAuctionList } from "./bottleAuctionList.stylex";

const lot: Outputs["auctions"]["list"]["results"][number] = {
  id: 1,
  bottleId: 1,
  auction: {
    id: 1,
    name: "September auction",
    url: "https://example.com/auction",
    site: { name: "Example auctions", type: "example" },
  },
  lotNumber: "183-3264",
  name: "Example",
  url: "https://example.com/lot",
  volume: 700,
  condition: null,
  state: "live",
  availability: "live",
  endsAt: null,
  currentBid: 9000,
  bidCurrency: "gbp",
  lastCheckedAt: "2026-09-30T12:00:00Z",
  result: null,
};

test("a bid is labelled separately and a stale bid is not shown as current", () => {
  const live = renderToStaticMarkup(<BottleAuctionList lots={[lot]} />);
  expect(live).toContain("Current bid:");
  expect(live).toContain("£90.00");
  expect(live).not.toContain("Hammer price");
  const stale = renderToStaticMarkup(
    <BottleAuctionList lots={[{ ...lot, availability: "unknown" }]} />,
  );
  expect(stale).toContain("Availability unknown");
  expect(stale).not.toContain("Current bid:");
});

test("closed lots without a result are not described as sold", () => {
  const html = renderToStaticMarkup(
    <BottleAuctionList
      lots={[{ ...lot, state: "closed", availability: "unavailable" }]}
    />,
  );
  expect(html).toContain("Result unknown");
  expect(html).not.toContain("Sold");
});

test("confirmed results use their own price and preserve a source link", () => {
  const html = renderToStaticMarkup(
    <BottleAuctionList
      lots={[
        {
          ...lot,
          state: "closed",
          availability: "unavailable",
          result: {
            id: 1,
            outcome: "sold",
            amount: 12000,
            currency: "gbp",
            priceKind: "hammer",
            soldAt: null,
            observedAt: lot.lastCheckedAt,
            priceNote: null,
          },
        },
      ]}
    />,
  );
  expect(html).toContain("Hammer price");
  expect(html).toContain("£120.00");
  expect(html).not.toContain("£90.00");
  expect(html).toContain('href="https://example.com/lot"');
});
