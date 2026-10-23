import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { AppLink } from "@peated/web/components/appLink";
import {
  KeyFacts,
  hasVisibleKeyFacts,
  type KeyFact,
} from "@peated/web/components/catalogDetails.stylex";
import { EntityLinks } from "@peated/web/components/entityLinks";
import type { BottleRatingSummaryProps } from "@peated/web/components/scoring.stylex";
import { BottleRatingSummary } from "@peated/web/components/scoring.stylex";
import { getBottleHeaderSpecs } from "@peated/web/lib/bottleMetadata";
import { getEntityUrl } from "@peated/web/lib/urls";
import { colors, effects, space } from "../../styles/tokens.stylex";
import { PageHeader } from "./pageLayout.stylex";

const NARROW = "@media (max-width: 900px)";
const PHONE = "@media (max-width: 480px)";

type Bottle = Outputs["tastings"]["details"]["bottle"];

export type BottlePageHeaderProps = {
  actions?: ReactNode;
  /** Fills the ratings column when a page rates the bottle another way, such as one member's tasting. */
  aside?: ReactNode;
  brand: string;
  brandHref?: string;
  metadata?: ReactNode;
  menu?: ReactNode;
  name: string;
  /** Links the name to the bottle page when the header appears on another page. */
  nameHref?: string;
  rating?: BottleRatingSummaryProps | null;
  specs?: readonly KeyFact[] | null;
};

/**
 * Derives the brand, name, distillers, and key facts every bottle header shows.
 * Bottle Presentation: the series moves from the title to the key facts.
 */
export function getBottleHeaderIdentity(
  bottle: Bottle,
): Pick<
  BottlePageHeaderProps,
  "brand" | "brandHref" | "metadata" | "name" | "specs"
> {
  const name = formatBottleDisplayName(bottle, {
    includeBrand: false,
    includeSeries: false,
  });
  return {
    brand: bottle.brand.shortName || bottle.brand.name,
    brandHref: getEntityUrl(bottle.brand),
    metadata: bottle.distillers.length ? (
      <EntityLinks entities={bottle.distillers} />
    ) : null,
    name,
    specs: getBottleHeaderSpecs(bottle, name),
  };
}

/** Presents a bottle's catalog identity, member actions, and community ratings. */
export function BottlePageHeader({
  actions,
  aside,
  brand,
  brandHref,
  metadata,
  menu,
  name,
  nameHref,
  rating,
  specs,
}: BottlePageHeaderProps) {
  // The wrapper shrinks to its content so an aside's own auto margins cannot
  // override the column's alignment.
  const ratings = rating ? (
    <BottleRatingSummary {...rating} />
  ) : aside ? (
    <div {...stylex.props(styles.aside)}>{aside}</div>
  ) : null;
  const hasRatings = Boolean(ratings);
  const keyFacts =
    specs && hasVisibleKeyFacts(specs) ? <KeyFacts facts={specs} /> : null;

  return (
    <div {...stylex.props(styles.root, hasRatings && styles.rootWithRatings)}>
      <PageHeader
        actions={actions}
        actionsPosition="start"
        facts={
          // Phones show the rating above the key facts instead of in its own
          // block below the actions; the column copy is hidden there. Without
          // key facts the rating stays in its column.
          keyFacts ? (
            <>
              {ratings ? (
                <div {...stylex.props(styles.phoneRatings)}>{ratings}</div>
              ) : null}
              {keyFacts}
            </>
          ) : null
        }
        metadata={metadata}
        menu={menu}
        title={
          <>
            {brandHref ? (
              <AppLink
                href={brandHref}
                title={brand}
                {...stylex.props(styles.titleLink)}
              >
                {brand}
              </AppLink>
            ) : (
              <span title={brand}>{brand}</span>
            )}{" "}
            {nameHref ? (
              <AppLink href={nameHref} {...stylex.props(styles.titleLink)}>
                {name}
              </AppLink>
            ) : (
              name
            )}
          </>
        }
      />
      {ratings ? (
        <div
          {...stylex.props(
            styles.ratings,
            keyFacts && styles.ratingsBesideFacts,
          )}
        >
          {ratings}
        </div>
      ) : null}
    </div>
  );
}

const styles = stylex.create({
  root: {
    boxSizing: "border-box",
    display: "grid",
    width: "100%",
    minWidth: 0,
    gridTemplateColumns: "minmax(0, 1fr)",
  },
  rootWithRatings: {
    gridTemplateColumns: {
      default: "minmax(0, 1fr) 260px",
      [NARROW]: "minmax(0, 1fr)",
    },
    columnGap: space.x6,
  },
  titleLink: {
    outline: "none",
    color: {
      default: "inherit",
      ":hover": colors.accentDeep,
      ":active": colors.accentDeep,
      ":focus-visible": colors.accentDeep,
    },
    textDecorationLine: {
      default: "none",
      ":hover": "underline",
      ":active": "underline",
      ":focus-visible": "underline",
    },
    textDecorationThickness: "1px",
    textUnderlineOffset: "3px",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  ratings: {
    boxSizing: "border-box",
    display: "grid",
    minWidth: 0,
    gridColumn: { default: "2", [NARROW]: "1" },
    gridRow: { default: "1", [NARROW]: "auto" },
    gridTemplateColumns: "minmax(0, 1fr)",
    justifyItems: "stretch",
    paddingTop: { default: space.x4, [NARROW]: 0 },
    paddingBottom: { default: space.x4, [NARROW]: 0 },
  },
  aside: {
    display: "flex",
    justifySelf: { default: "end", [PHONE]: "start" },
  },
  ratingsBesideFacts: {
    display: { default: "grid", [PHONE]: "none" },
  },
  phoneRatings: {
    display: { default: "none", [PHONE]: "block" },
    marginBottom: space.x3,
  },
});
