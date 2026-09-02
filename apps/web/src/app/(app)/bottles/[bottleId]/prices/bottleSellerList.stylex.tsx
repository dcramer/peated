import type { Outputs } from "@peated/server/orpc/router";
import { AppLink } from "@peated/web/components/appLink";
import Price from "@peated/web/components/price";
import TimeSince from "@peated/web/components/timeSince";
import * as stylex from "@stylexjs/stylex";

import { colors, fonts, space } from "../../../../../styles/tokens.stylex";

type Seller = Outputs["bottles"]["prices"]["list"]["results"][number];

export function BottleSellerList({ sellers }: { sellers: readonly Seller[] }) {
  return (
    <ul aria-label="Bottle sellers" {...stylex.props(styles.list)}>
      {sellers.map((seller) => {
        const content = (
          <>
            <span {...stylex.props(styles.details)}>
              <strong {...stylex.props(styles.seller)}>
                {seller.site.name}
              </strong>
              <span {...stylex.props(styles.listing)}>{seller.name}</span>
              <span {...stylex.props(styles.metadata)}>
                {seller.volume.toLocaleString("en-US")} ml · Updated{" "}
                <TimeSince date={seller.updatedAt} />
              </span>
            </span>
            <span {...stylex.props(styles.price)}>
              <Price currency={seller.currency} value={seller.price} />
            </span>
          </>
        );

        return (
          <li
            key={seller.id}
            {...stylex.props(styles.item, !seller.isValid && styles.outdated)}
          >
            {seller.isValid ? (
              <AppLink
                href={seller.url}
                {...stylex.props(styles.row, styles.link)}
              >
                {content}
              </AppLink>
            ) : (
              <div {...stylex.props(styles.row)}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const styles = stylex.create({
  list: {
    width: "100%",
    maxWidth: "800px",
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  item: {
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
  },
  row: {
    display: "grid",
    minWidth: 0,
    gridTemplateColumns: "minmax(0, 1fr) auto",
    alignItems: "start",
    columnGap: space.x4,
    paddingTop: "13px",
    paddingRight: space.x3,
    paddingBottom: "13px",
    paddingLeft: space.x3,
    color: colors.ink,
    fontFamily: fonts.reading,
    textDecorationLine: "none",
  },
  link: {
    backgroundColor: {
      default: "transparent",
      ":hover": colors.surface,
      ":active": colors.surface,
    },
  },
  details: {
    display: "block",
    minWidth: 0,
  },
  seller: {
    display: "block",
    color: colors.accentDeep,
    fontSize: "14px",
    fontWeight: 700,
    lineHeight: 1.35,
  },
  listing: {
    display: "block",
    marginTop: space.x1,
    fontSize: "13px",
    lineHeight: 1.4,
  },
  metadata: {
    display: "block",
    marginTop: space.x2,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    lineHeight: 1.4,
  },
  price: {
    paddingTop: "1px",
    fontFamily: fonts.data,
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.35,
    whiteSpace: "nowrap",
  },
  outdated: {
    opacity: 0.7,
  },
});
