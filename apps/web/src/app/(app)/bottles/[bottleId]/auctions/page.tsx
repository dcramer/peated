import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import { EmptyState } from "@peated/web/components/feedback.stylex";
import { CursorPager } from "@peated/web/components/lists.stylex";
import { getBottlePage } from "@peated/web/lib/bottlePage.server";
import { parseCatalogRouteId } from "@peated/web/lib/catalogRoute";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { getCatalogSeoMetadata } from "@peated/web/lib/seoMetadata";
import { getBottleUrl } from "@peated/web/lib/urls";
import type { Metadata } from "next";
import { BottleAuctionList } from "./bottleAuctionList.stylex";
import { AuctionWatch } from "./watch";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ bottleId: string }>;
}): Promise<Metadata> {
  const { bottleId } = await params;
  const bottle = await getBottlePage(parseCatalogRouteId(bottleId));
  const name = formatBottleDisplayName(bottle);
  return getCatalogSeoMetadata({
    title: `${name} auctions`,
    description: `Auction listings and recorded sale prices for ${name} on Peated.`,
    url: `${getBottleUrl(bottle)}/auctions`,
  });
}

export default async function BottleAuctionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ bottleId: string }>;
  searchParams: Promise<{ cursor?: string }>;
}) {
  const { bottleId } = await params;
  const bottle = await getBottlePage(parseCatalogRouteId(bottleId));
  const page = Number((await searchParams).cursor ?? 1);
  const cursor = Number.isSafeInteger(page) && page > 0 ? page : 1;
  const { client } = await getAnonymousServerClient();
  const data = await client.auctions.list({ bottle: bottle.id, cursor });
  const base = `${getBottleUrl(bottle)}/auctions`;
  return (
    <>
      <AuctionWatch bottleId={bottle.id} />
      {data.results.length ? (
        <BottleAuctionList lots={data.results} />
      ) : (
        <EmptyState heading="No auctions recorded">
          Peated does not have an auction listing for this bottle.
        </EmptyState>
      )}
      <CursorPager
        ariaLabel="Auction history pages"
        page={cursor}
        nextHref={
          data.rel.nextCursor
            ? `${base}?cursor=${data.rel.nextCursor}`
            : undefined
        }
        previousHref={
          data.rel.prevCursor
            ? `${base}?cursor=${data.rel.prevCursor}`
            : undefined
        }
      />
    </>
  );
}
