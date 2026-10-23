import {
  AuctionObservationSchema,
  AuctionSourceSchema,
  type AuctionObservation,
} from "@peated/server/schemas/auctions";
import { load } from "cheerio";
import { z } from "zod";
import type { ScraperAdapter } from "../types";

const ORIGIN = "https://www.scotchwhiskyauctions.com";
const TARGET = "scotchwhiskyauctions";
export const ScotchWhiskyAuctionsCursorSchema = z
  .object({
    auctions: z.array(AuctionSourceSchema).max(2),
    auctionIndex: z.number().int().nonnegative(),
    page: z.number().int().min(1).max(500),
  })
  .strict();
export const ScotchWhiskyAuctionsObservationSchema = z
  .array(AuctionObservationSchema)
  .min(1)
  .max(500);
type Cursor = z.infer<typeof ScotchWhiskyAuctionsCursorSchema>;

function sourceUrl(path: string) {
  const url = new URL(path, ORIGIN);
  if (
    url.origin !== ORIGIN ||
    !/^\/auctions\/\d+-[^/]+\/(?:\d+-[^/]+\/)?$/.test(url.pathname)
  )
    throw new Error("Unexpected Scotch Whisky Auctions URL.");
  url.hash = "";
  url.search = "";
  return url;
}

export function parseScotchWhiskyAuctionsIndex(html: string) {
  const $ = load(html);
  // Initial collection covers the current/recent auction window, not the full archive.
  return $(".auctions a.auction")
    .toArray()
    .slice(0, 2)
    .map((element) => {
      const url = sourceUrl($(element).attr("href") ?? "");
      return AuctionSourceSchema.parse({
        sourceKey: url.pathname.split("/")[2].split("-")[0],
        name: $(element).find("h4").text().trim(),
        url: url.toString(),
      });
    });
}

export function parseScotchWhiskyAuctionPage(
  html: string,
  auction: z.infer<typeof AuctionSourceSchema>,
  observedAt = new Date(),
) {
  const $ = load(html);
  const heading = $("#lotswrap > h3").first().text().trim();
  const ended = /^Ended\b/i.test(heading);
  const items: AuctionObservation[] = [];
  for (const element of $("#lots a.lot").toArray()) {
    const tile = $(element);
    const name = tile.find("h4").text().trim();
    // Auction collector owns one-Bottle lots; explicit source set/quantity wording excludes bundles.
    const quantity = name.match(
      /\b(\d+)\s*(?:bottles?|[x×]\s*\d+\s*(?:ml|cl|l))\b/i,
    );
    if (
      (quantity && Number(quantity[1]) > 1) ||
      /\b(?:gift\s+set|set\s+of|collection\s+of|sampler|multipack)\b/i.test(
        name,
      )
    )
      continue;
    const url = sourceUrl(tile.attr("href") ?? "");
    const info = tile.find('[id^="info_"]').text().trim();
    const sold = info.match(/^Sold for £([\d,]+(?:\.\d{1,2})?)\b/i);
    const unsold = /\b(?:unsold|not sold|reserve not met)\b/i.test(info);
    const withdrawn = /\bwithdrawn\b/i.test(info);
    const bid = info.match(
      /\b(?:current|highest|winning) bid:?\s*£([\d,]+(?:\.\d{1,2})?)/i,
    );
    const state = withdrawn
      ? "withdrawn"
      : ended || sold || unsold
        ? "closed"
        : /^Ends\b/i.test(heading)
          ? "live"
          : "unknown";
    const volume = name.match(/\b(\d+(?:\.\d+)?)\s*(ml|cl|l)\b/i);
    const amount = (text: string) =>
      Math.round(Number(text.replaceAll(",", "")) * 100);
    const lot: AuctionObservation["lot"] = {
      sourceKey: url.pathname.split("/")[3].split("-")[0],
      lotNumber:
        tile
          .find("h6")
          .text()
          .replace(/^Lot no\s*/i, "")
          .trim() || null,
      name,
      url: url.toString(),
      state,
    };
    if (volume)
      lot.volume = Math.round(
        Number(volume[1]) *
          (volume[2].toLowerCase() === "l"
            ? 1000
            : volume[2].toLowerCase() === "cl"
              ? 10
              : 1),
      );
    if (bid && amount(bid[1]) > 0 && state === "live") {
      lot.currentBid = amount(bid[1]);
      lot.bidCurrency = "gbp";
    }
    if (sold) {
      lot.result = {
        outcome: "sold",
        amount: amount(sold[1]),
        currency: "gbp",
        priceKind: "hammer",
        soldAt: null,
      };
    } else if (unsold) {
      lot.result = {
        outcome: "unsold",
        amount: null,
        currency: null,
        priceKind: null,
        soldAt: null,
      };
    }
    items.push(
      AuctionObservationSchema.parse({
        auction,
        observedAt: observedAt.toISOString(),
        lot,
      }),
    );
  }
  const nextValue = $("#nextpage").attr("data-value");
  const nextPage = nextValue ? Number(nextValue) : null;
  if (
    nextPage !== null &&
    (!Number.isInteger(nextPage) || nextPage < 1 || nextPage > 500)
  )
    throw new Error("Invalid auction pagination.");
  if (!$("#lots").length) throw new Error("Auction lot index is missing.");
  return { items, nextPage };
}

export const scotchWhiskyAuctionsAdapter: ScraperAdapter<
  Cursor,
  AuctionObservation[]
> = async ({ cursor, session }) => {
  let state = cursor;
  if (!state) {
    const response = await session.request({
      target: TARGET,
      url: new URL("/auctions/", ORIGIN),
    });
    state = {
      auctions: parseScotchWhiskyAuctionsIndex(response.body),
      auctionIndex: 0,
      page: 1,
    };
    if (!state.auctions.length)
      throw new Error("Auction discovery returned no auction links.");
    await session.checkpoint(state);
  }
  while (state.auctionIndex < state.auctions.length) {
    const auction = state.auctions[state.auctionIndex];
    const url = new URL(auction.url);
    if (state.page > 1) url.searchParams.set("page", String(state.page));
    const observedAt = new Date();
    const response = await session.request({ target: TARGET, url });
    const { items, nextPage } = parseScotchWhiskyAuctionPage(
      response.body,
      auction,
      observedAt,
    );
    if (items.length)
      await session.emit({
        sourceKey: `${auction.sourceKey}:page:${state.page}`,
        itemCount: items.length,
        value: items,
      });
    if (nextPage !== null && nextPage <= state.page)
      throw new Error("Auction pagination did not advance.");
    state =
      nextPage === null
        ? { ...state, auctionIndex: state.auctionIndex + 1, page: 1 }
        : { ...state, page: nextPage };
    await session.checkpoint(state);
  }
};
