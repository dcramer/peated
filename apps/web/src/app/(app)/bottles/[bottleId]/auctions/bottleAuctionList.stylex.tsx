import type { Outputs } from "@peated/server/orpc/router";
import { ItemList, ItemListItem } from "@peated/web/components/itemList.stylex";
import Price from "@peated/web/components/price";
import { TextLink } from "@peated/web/components/textLink.stylex";
import TimeSince from "@peated/web/components/timeSince";
import * as stylex from "@stylexjs/stylex";
import { foundationStyles } from "../../../../../styles/foundations.stylex";
import { colors, space } from "../../../../../styles/tokens.stylex";

type Lot = Outputs["auctions"]["list"]["results"][number];
const availabilityLabels = {
  live: "On auction",
  upcoming: "Upcoming",
  aftersale: "Available after auction",
  unavailable: "Auction ended",
  unknown: "Availability unknown",
};

/** Source lots show availability separately from confirmed results and current bids. */
export function BottleAuctionList({ lots }: { lots: readonly Lot[] }) {
  return (
    <ItemList ariaLabel="Auction listings and history">
      {lots.map((lot) => (
        <ItemListItem key={lot.id}>
          <div {...stylex.props(styles.row)}>
            <TextLink href={lot.url}>
              {lot.auction.site.name} ·{" "}
              {lot.lotNumber ? `Lot ${lot.lotNumber}` : lot.auction.name}
            </TextLink>
            <div {...stylex.props(foundationStyles.body)}>
              {lot.availability === "unavailable" && lot.state === "withdrawn"
                ? "Withdrawn"
                : availabilityLabels[lot.availability]}
            </div>
            <div {...stylex.props(foundationStyles.metadata, styles.metadata)}>
              {lot.auction.name}
              {lot.volume ? ` · ${lot.volume} ml` : ""} · Checked{" "}
              <TimeSince date={lot.lastCheckedAt} />
            </div>
            {lot.endsAt ? (
              <div
                {...stylex.props(foundationStyles.metadata, styles.metadata)}
              >
                Listed closing time:{" "}
                {new Date(lot.endsAt).toLocaleString("en-GB", {
                  timeZone: "UTC",
                })}{" "}
                UTC
              </div>
            ) : null}
            {lot.condition ? (
              <div {...stylex.props(foundationStyles.metadata)}>
                {lot.condition}
              </div>
            ) : null}
            {lot.result ? (
              <div {...stylex.props(foundationStyles.body)}>
                {lot.result.outcome === "sold" ? (
                  <>
                    Sold
                    {lot.result.amount && lot.result.currency ? (
                      <>
                        {" "}
                        ·{" "}
                        {lot.result.priceKind === "hammer"
                          ? "Hammer price"
                          : "After-auction price"}
                        :{" "}
                        <Price
                          value={lot.result.amount}
                          currency={lot.result.currency}
                        />
                      </>
                    ) : (
                      " · Sale price unknown"
                    )}
                  </>
                ) : lot.result.outcome === "unsold" ? (
                  "Unsold"
                ) : lot.result.outcome === "cancelled" ? (
                  "Cancelled"
                ) : (
                  "Result unknown"
                )}
                {lot.result.priceKind === "hammer" ? (
                  <div
                    {...stylex.props(
                      foundationStyles.metadata,
                      styles.metadata,
                    )}
                  >
                    Winning bid before fees and taxes.
                  </div>
                ) : null}
                {lot.result.priceNote ? (
                  <div {...stylex.props(foundationStyles.metadata)}>
                    {lot.result.priceNote}
                  </div>
                ) : null}
              </div>
            ) : lot.currentBid &&
              lot.bidCurrency &&
              lot.availability === "live" ? (
              <div {...stylex.props(foundationStyles.body)}>
                Current bid:{" "}
                <Price value={lot.currentBid} currency={lot.bidCurrency} />
              </div>
            ) : lot.availability === "unavailable" ? (
              <div {...stylex.props(foundationStyles.metadata)}>
                Result unknown
              </div>
            ) : null}
          </div>
        </ItemListItem>
      ))}
    </ItemList>
  );
}

const styles = stylex.create({
  row: {
    display: "flex",
    flexDirection: "column",
    gap: space.x2,
    padding: space.x3,
  },
  metadata: { color: colors.inkMuted },
});
