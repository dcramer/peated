import type { BottleExtractedDetails } from "@peated/bottle-classifier/contract";
import { BottleExtractedDetailsSchema } from "@peated/bottle-classifier/contract";
import {
  AuctionObservationSchema,
  type AuctionObservation,
} from "@peated/server/schemas/auctions";
import { load } from "cheerio";
import { z } from "zod";
import { ScraperHttpStatusError } from "../http";
import type { ScraperAdapter } from "../types";

const ORIGIN = "https://www.klwines.com";
const IMAGE_ORIGIN = "https://cdn.klwines.com";
const TARGET = "klwines";
const LIST_PATH = "/products/auctions";
// K&L's search filter for spirits auctions, with out-of-stock lots included so
// closed lots and their results stay on the list.
const LIST_FILTER = "sv2_dflt-stock-all!110$eq$Spirits$True$";
const PAGE_SIZE = 48;
// Two overlapping batches list about 1,800 spirits lots; this is a hard stop.
const MAX_PAGES = 60;
const TIME_ZONE = "America/Los_Angeles";

/**
 * Auction scope rule (owner: auctions, decided 2026-11-10): K&L's own
 * varietal field decides which lots are whisky. Lots it files under another
 * spirit are skipped before their pages are read.
 */
const WHISKY_VARIETALS = new Set([
  "Bourbon",
  "Canadian",
  "Irish",
  "Malt",
  "Rye",
  "Scotch",
  "Whisk(e)y - Other",
]);

export const KlwinesAuctionsCursorSchema = z
  .object({
    page: z.number().int().min(1).max(MAX_PAGES),
    // The next list record to read on this page.
    recordIndex: z.number().int().min(0).max(PAGE_SIZE),
  })
  .strict();
export const KlwinesAuctionsObservationSchema = z
  .array(AuctionObservationSchema)
  .min(1)
  .max(1);
export type KlwinesAuctionsObservation = z.infer<
  typeof KlwinesAuctionsObservationSchema
>;
type Cursor = z.infer<typeof KlwinesAuctionsCursorSchema>;

const IsoSchema = z.iso.datetime({ offset: true });
const ListRecordSchema = z.object({
  sku: z.string().regex(/^\d{1,12}$/),
  itemName: z.string().trim().min(1).max(500),
  productType: z.string().nullable(),
  varietal: z.string().nullable(),
  lotItemCount: z.number().int(),
  lotVintagePrefix: z.string().nullable(),
  containerType: z.string().nullable(),
  imageUrl: z.string().nullable(),
  winningBidAmount: z.number().nonnegative(),
  numberBids: z.number().int().nonnegative(),
  auctionStartDT: IsoSchema,
  auctionEndDT: IsoSchema,
  originalAuctionEndDT: IsoSchema.nullable(),
  auctionStatus: z.string(),
});
export type KlwinesAuctionListRecord = z.infer<typeof ListRecordSchema>;
const ListDataSchema = z.object({
  records: z.array(z.object({ record: ListRecordSchema })).max(PAGE_SIZE),
  totalRecordsFound: z.number().int().nonnegative(),
});

const LotItemSchema = z.object({
  ItemName: z.string().nullable(),
  Quantity: z.number().int(),
  BottleSize: z.string().nullable(),
  Condition: z.string().nullable(),
  Provenance: z.string().nullable(),
  AdditionalNotes: z.string().nullable(),
});
const LotContextSchema = z.object({
  Lot: z.object({
    SKU: z.number().int().positive(),
    LotName: z.string().trim().min(1),
    LotDescription: z.string().nullable(),
    LotItems: z.array(LotItemSchema),
  }),
});
export type KlwinesAuctionLotPage = z.infer<typeof LotContextSchema>["Lot"];

const NextDataSchema = z.object({
  props: z.object({
    pageProps: z.object({
      dehydratedState: z.object({
        queries: z.array(
          z.object({
            queryKey: z.array(z.unknown()),
            state: z.object({ data: z.unknown() }),
          }),
        ),
      }),
    }),
  }),
});

function query(html: string, key: string) {
  const text = load(html)("script#__NEXT_DATA__").first().text();
  if (!text) throw new Error("K&L page data is missing.");
  const { queries } = NextDataSchema.parse(JSON.parse(text)).props.pageProps
    .dehydratedState;
  return queries.find((entry) => entry.queryKey[0] === key)?.state.data;
}

/** The address of one page of K&L's spirits auction list. */
export function klwinesAuctionListUrl(page: number) {
  const url = new URL(LIST_PATH, ORIGIN);
  url.searchParams.set("filters", LIST_FILTER);
  // TODO(auctions): confirm K&L's page parameter from a page-2 list URL
  // before the first run; the pager is script-only and shows no link.
  if (page > 1) url.searchParams.set("page", String(page));
  return url;
}

export function klwinesAuctionLotUrl(sku: string) {
  return new URL(`/auctions/bidding/${sku}`, ORIGIN);
}

/** True for a K&L auction lot page address. */
export function isKlwinesAuctionLotUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch (error) {
    if (error instanceof TypeError) return false;
    throw error;
  }
  return (
    url.origin === ORIGIN &&
    !url.username &&
    !url.password &&
    /^\/auctions\/bidding\/\d{1,12}$/.test(url.pathname)
  );
}

export function parseKlwinesAuctionList(html: string) {
  const data = ListDataSchema.parse(query(html, "product-search"));
  return {
    records: data.records.map(({ record }) => record),
    total: data.totalRecordsFound,
  };
}

/** A single-bottle whisky lot, by K&L's own varietal and item count. */
export function isKlwinesWhiskyLot(record: KlwinesAuctionListRecord) {
  return (
    record.productType === "Distilled Spirits" &&
    record.varietal !== null &&
    WHISKY_VARIETALS.has(record.varietal) &&
    record.lotItemCount === 1
  );
}

export function parseKlwinesAuctionLotPage(html: string, sku: string) {
  const { Lot } = LotContextSchema.parse(query(html, "GetAuctionContext"));
  if (String(Lot.SKU) !== sku)
    throw new Error("K&L lot page is for another lot.");
  return Lot;
}

function volumeMl(text: string | null | undefined) {
  if (!text) return null;
  if (/\bpint\b/i.test(text) && !/\bhalf\b/i.test(text)) return 473;
  const match = text.match(/(\d+(?:\.\d+)?)\s*(ml|cl|l)\b/i);
  if (!match) return null;
  const ml =
    Number(match[1]) *
    ({ ml: 1, cl: 10, l: 1000 }[match[2].toLowerCase()] ?? 0);
  return Number.isInteger(ml) && ml > 0 ? ml : null;
}

/**
 * K&L lot facts that the page states outright: the strength as proof and the
 * bottling year, both in the item's condition note ("Bottled 2024. 119 Proof.").
 * Release text and K&L's vintage field are left to the classifier, because
 * K&L uses the vintage for distillation, release, and batch years alike.
 */
export function klwinesSourceBottleIdentity(condition: string | null) {
  if (!condition) return null;
  const facts: Partial<BottleExtractedDetails> = {};
  const proofs = [...condition.matchAll(/\b(\d{2,3}(?:\.\d+)?)\s*proof\b/gi)];
  if (proofs.length === 1) {
    const abv = Number(proofs[0][1]) / 2;
    if (abv > 0 && abv <= 100) facts.abv = abv;
  }
  const bottled = [...condition.matchAll(/\bbottled\s+(?:in\s+)?(\d{4})\b/gi)];
  if (bottled.length === 1) {
    const year = Number(bottled[0][1]);
    if (year >= 1800 && year <= new Date().getUTCFullYear())
      facts.bottling_year = year;
  }
  return Object.keys(facts).length
    ? BottleExtractedDetailsSchema.parse(facts)
    : null;
}

function batchDay(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function batchName(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, date)));
  return `K&L Spirits Auction ending ${label}`;
}

function imageUrl(value: string | null) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    // Auction collection keeps photo links for review, not catalog image reuse.
    if (url.origin === IMAGE_ORIGIN && !url.username && !url.password)
      return url.toString();
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
  }
  return undefined;
}

/**
 * Builds one lot observation from a list record and, when it was read, the
 * lot page. Lots are grouped into auctions by their original closing day in
 * Pacific time, because K&L closes a batch of lots on one day and has no
 * auction id. A late bid moves the lot's own end time, not its batch.
 */
export function klwinesAuctionObservation(
  record: KlwinesAuctionListRecord,
  page: KlwinesAuctionLotPage | null,
  observedAt = new Date(),
) {
  const day = batchDay(record.originalAuctionEndDT ?? record.auctionEndDT);
  const amount = Math.round(record.winningBidAmount * 100);
  const state =
    record.auctionStatus === "Active"
      ? new Date(record.auctionStartDT) > observedAt
        ? "upcoming"
        : "live"
      : record.auctionStatus === "Order_Complete" ||
          record.auctionStatus === "Ended_No_Win"
        ? "closed"
        : "unknown";
  const prefix = record.lotVintagePrefix?.trim();
  const lot: AuctionObservation["lot"] = {
    sourceKey: record.sku,
    name:
      prefix && /^\d{4}$/.test(prefix)
        ? `${prefix} ${record.itemName}`
        : record.itemName,
    url: klwinesAuctionLotUrl(record.sku).toString(),
    state,
    endsAt: record.auctionEndDT,
  };
  const image = imageUrl(record.imageUrl);
  if (image) lot.imageUrl = image;
  if (page) {
    const item = page.LotItems[0];
    lot.volume = volumeMl(item.BottleSize) ?? volumeMl(record.containerType);
    const condition = item.Condition?.trim() || null;
    lot.condition = condition?.slice(0, 2000) ?? null;
    lot.sourceBottleIdentity = klwinesSourceBottleIdentity(condition);
  }
  if (state === "live" && record.numberBids > 0 && amount > 0) {
    lot.currentBid = amount;
    lot.bidCurrency = "usd";
  }
  // K&L lists an unsold lot's starting price as its winning bid, so only a
  // completed order with bids is a sale.
  if (
    record.auctionStatus === "Order_Complete" &&
    record.numberBids > 0 &&
    amount > 0
  ) {
    lot.result = {
      outcome: "sold",
      amount,
      currency: "usd",
      priceKind: "hammer",
      soldAt: record.auctionEndDT,
    };
  } else if (record.auctionStatus === "Ended_No_Win") {
    lot.result = {
      outcome: "unsold",
      amount: null,
      currency: null,
      priceKind: null,
      soldAt: null,
    };
  }
  return AuctionObservationSchema.parse({
    auction: {
      sourceKey: day,
      name: batchName(day),
      url: new URL(LIST_PATH, ORIGIN).toString(),
    },
    lot,
    observedAt: observedAt.toISOString(),
  });
}

/** A lot page holds one bottle when it lists one item with quantity one. */
function isSingleBottle(page: KlwinesAuctionLotPage) {
  return page.LotItems.length === 1 && page.LotItems[0].Quantity === 1;
}

export const klwinesAuctionsAdapter: ScraperAdapter<
  Cursor,
  KlwinesAuctionsObservation
> = async ({ cursor, session }) => {
  let state: Cursor = cursor ?? { page: 1, recordIndex: 0 };
  while (true) {
    const response = await session.request({
      target: TARGET,
      url: klwinesAuctionListUrl(state.page),
    });
    const { records, total } = parseKlwinesAuctionList(response.body);
    for (let index = state.recordIndex; index < records.length; index++) {
      const record = records[index];
      if (isKlwinesWhiskyLot(record)) {
        let page: KlwinesAuctionLotPage | null = null;
        try {
          const lotResponse = await session.request({
            target: TARGET,
            url: klwinesAuctionLotUrl(record.sku),
          });
          page = parseKlwinesAuctionLotPage(lotResponse.body, record.sku);
        } catch (error) {
          if (
            !(error instanceof ScraperHttpStatusError) ||
            ![404, 410].includes(error.status)
          )
            throw error;
          // A removed lot page still leaves the list's sale facts to save.
        }
        if (!page || isSingleBottle(page))
          await session.emit({
            sourceKey: `lot:${record.sku}`,
            value: [klwinesAuctionObservation(record, page)],
          });
        // Each lot page is a request, so save the place after every one.
        state = { ...state, recordIndex: index + 1 };
        await session.checkpoint(state);
      }
    }
    if (
      !records.length ||
      state.page * PAGE_SIZE >= total ||
      state.page >= MAX_PAGES
    )
      return;
    state = { page: state.page + 1, recordIndex: 0 };
    await session.checkpoint(state);
  }
};
