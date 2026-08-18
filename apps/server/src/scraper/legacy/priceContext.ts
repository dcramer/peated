import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import type { ScraperSession } from "../types";
import { runLegacyRequestContext } from "./requestContext";
import type { StorePrice } from "./scraper";

export type LegacyPriceCursor = { sequence: number; page: number };

type LegacyPriceContext = {
  cursor: LegacyPriceCursor | null;
  invocation: number;
  session: ScraperSession<LegacyPriceCursor, StorePrice[]>;
  targetKey: string;
};

const legacyPriceStorage = new AsyncLocalStorage<LegacyPriceContext>();

export async function runLegacyPriceAdapter<T>({
  cursor,
  session,
  targetKey,
  run,
}: {
  cursor: LegacyPriceCursor | null;
  session: ScraperSession<LegacyPriceCursor, StorePrice[]>;
  targetKey: string;
  run: () => Promise<T>;
}) {
  return await runLegacyRequestContext({
    session,
    targetKey,
    run: async () =>
      await legacyPriceStorage.run(
        { cursor, invocation: 0, session, targetKey },
        run,
      ),
  });
}

export function getLegacyPriceContext() {
  return legacyPriceStorage.getStore();
}

export function beginLegacyPricePagination() {
  const context = legacyPriceStorage.getStore();
  if (!context) return null;
  const sequence = context.invocation;
  context.invocation += 1;
  return {
    sequence,
    skip: Boolean(context.cursor && sequence < context.cursor.sequence),
    startPage:
      context.cursor && sequence === context.cursor.sequence
        ? context.cursor.page
        : 1,
  };
}

export async function checkpointLegacyPricePage(
  sequence: number,
  page: number,
) {
  const context = legacyPriceStorage.getStore();
  if (!context) return;
  await context.session.checkpoint({ sequence, page });
}

export async function completeLegacyPricePagination(sequence: number) {
  const context = legacyPriceStorage.getStore();
  if (!context) return;
  await context.session.checkpoint({ sequence: sequence + 1, page: 1 });
}

export async function emitLegacyPriceBatch(prices: StorePrice[]) {
  const context = legacyPriceStorage.getStore();
  if (!context) return false;
  const sourceKey = createHash("sha256")
    .update(
      prices
        .map((price) => `${price.url}\u0000${price.volume}`)
        .sort()
        .join("\u0001"),
    )
    .digest("hex");
  await context.session.emit({
    sourceKey,
    itemCount: prices.length,
    value: prices,
  });
  return true;
}
