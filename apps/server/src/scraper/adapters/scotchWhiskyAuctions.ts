import {
  AuctionLotDetailObservationSchema,
  AuctionLotDetailRequestSchema,
  AuctionObservationSchema,
  AuctionSourceSchema,
  type AuctionObservation,
} from "@peated/server/schemas/auctions";
import { load } from "cheerio";
import { z } from "zod";
import { ScraperHttpStatusError } from "../http";
import type { ScraperAdapter } from "../types";
import { parseDate } from "./dates";
import { parseScotchWhiskyAuctionDetails } from "./scotchWhiskyAuctionDetails";

const ORIGIN = "https://www.scotchwhiskyauctions.com";
const IMAGE_ORIGIN = "https://d3suvtcq00dftb.cloudfront.net";
const TARGET = "scotchwhiskyauctions";
const IndexCursorSchema = z
  .object({
    scope: z.enum(["recent", "current"]).default("recent"),
    auctions: z.array(AuctionSourceSchema).max(2),
    auctionIndex: z.number().int().nonnegative(),
    page: z.number().int().min(1).max(500),
  })
  .strict();
export const ScotchWhiskyAuctionDetailsCursorSchema = z
  .object({
    kind: z.literal("details"),
    lots: z.array(AuctionLotDetailRequestSchema).min(1).max(25),
    lotIndex: z.number().int().min(0).max(25),
  })
  .strict();
export const ScotchWhiskyAuctionsCursorSchema = z.union([
  IndexCursorSchema,
  ScotchWhiskyAuctionDetailsCursorSchema,
]);
export const ScotchWhiskyAuctionsObservationSchema = z.union([
  z.array(AuctionObservationSchema).min(1).max(500),
  AuctionLotDetailObservationSchema,
]);
export type ScotchWhiskyAuctionsObservation = z.infer<
  typeof ScotchWhiskyAuctionsObservationSchema
>;
type Cursor = z.infer<typeof ScotchWhiskyAuctionsCursorSchema>;

function sourceUrl(path: string) {
  const url = new URL(path, ORIGIN);
  if (
    url.origin !== ORIGIN ||
    url.username ||
    url.password ||
    !/^\/auctions\/\d+-[^/]+\/(?:\d+-[^/]+\/)?$/.test(url.pathname)
  )
    throw new Error("Unexpected Scotch Whisky Auctions URL.");
  url.hash = "";
  url.search = "";
  return url;
}

function lotImageUrl(style: string | undefined) {
  const path = style?.match(
    /background-image\s*:\s*url\(\s*(?:'([^']+)'|"([^"]+)"|([^\s)]+))\s*\)/i,
  );
  const value = path?.[1] ?? path?.[2] ?? path?.[3];
  if (!value) return undefined;
  try {
    const url = new URL(value, ORIGIN);
    // The auction collector keeps published photo links for matching, not catalog image reuse.
    if (
      (url.origin === ORIGIN || url.origin === IMAGE_ORIGIN) &&
      !url.username &&
      !url.password
    )
      return url.toString();
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    // Missing or invalid optional photo links do not discard lot and price facts.
  }
  return undefined;
}

export function parseScotchWhiskyAuctionsIndex(
  html: string,
  scope: "recent" | "current" = "recent",
) {
  const $ = load(html);
  const links = $(".auctions a.auction").toArray();
  let selected = links.slice(0, 2);
  if (scope === "current") {
    const open = links.filter((element) =>
      /^Ends\b/i.test($(element).find("h5").text().trim()),
    );
    if (open.length > 2)
      throw new Error("Auction discovery exceeds the open-auction limit.");
    const ended = links
      .map((element) => {
        const heading = $(element).find("h5").text().trim();
        return {
          element,
          // SWA discovery requires a published year; generic date parsing can infer one from a partial date.
          date:
            /^Ended\b/i.test(heading) && /\b\d{4}\b/.test(heading)
              ? parseDate(heading.replace(/^Ended\s+/i, ""))
              : null,
        };
      })
      .filter(({ date }) => date !== null)
      .sort((a, b) => b.date!.getTime() - a.date!.getTime())[0]?.element;
    selected = open.length ? open : ended ? [ended] : [];
    if (!selected.length)
      throw new Error("Auction discovery has no recognized auction states.");
  }
  return selected.map((element) => {
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
  const items: z.output<typeof AuctionObservationSchema>[] = [];
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
    // SWA results need closure before an unmet reserve becomes a final outcome.
    const unsold =
      /\b(?:unsold|not sold)\b/i.test(info) ||
      (ended && /\breserve not met\b/i.test(info));
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
    const imageUrl = lotImageUrl(tile.find(".aucimg").attr("style"));
    if (imageUrl) lot.imageUrl = imageUrl;
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
  ScotchWhiskyAuctionsObservation
> = async ({ cursor, session }) => {
  if (cursor && "kind" in cursor) {
    let state = cursor;
    while (state.lotIndex < state.lots.length) {
      const request = state.lots[state.lotIndex];
      const url = sourceUrl(request.url);
      if (!/^\/auctions\/\d+-[^/]+\/\d+-[^/]+\/$/.test(url.pathname))
        throw new Error("Auction detail URL must identify a lot.");
      let facts: ReturnType<typeof parseScotchWhiskyAuctionDetails> | null =
        null;
      try {
        const response = await session.request({ target: TARGET, url });
        facts = parseScotchWhiskyAuctionDetails(response.body);
      } catch (error) {
        if (
          !(error instanceof ScraperHttpStatusError) ||
          ![404, 410].includes(error.status)
        )
          throw error;
        // Auction collector treats removed pages as checked, not as a new sale or availability observation.
      }
      await session.emit({
        sourceKey: `details:${request.lotId}:${request.fingerprint}`,
        value: {
          kind: "details",
          request,
          name: facts?.name ?? null,
          sourceBottleIdentity: facts?.sourceBottleIdentity ?? null,
          volume: facts?.volume ?? null,
          checkedAt: new Date().toISOString(),
        },
      });
      state = { ...state, lotIndex: state.lotIndex + 1 };
      await session.checkpoint(state);
    }
    return;
  }
  let state = cursor;
  if (!state || state.auctions.length === 0) {
    const scope = state?.scope ?? "recent";
    const response = await session.request({
      target: TARGET,
      url: new URL("/auctions/", ORIGIN),
    });
    state = {
      scope,
      auctions: parseScotchWhiskyAuctionsIndex(response.body, scope),
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
