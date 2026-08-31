import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import type { ReviewScoreProps, TastingRatingDistributionProps } from "..";
import {
  AppLink,
  BottleVisual,
  Chip,
  ImageAttribution,
  PeatedId,
  ReviewScore,
  TastingRatingDistribution,
} from "..";
import { foundationStyles } from "../../styles/foundations.stylex";
import { colors, effects, fonts, space } from "../../styles/tokens.stylex";

const NARROW = "@media (max-width: 900px)";
const COMPACT = "@media (max-width: 639px)";
const PHONE = "@media (max-width: 480px)";

export type BottleMemberStatus = {
  hasTasted: boolean;
  isLibrary: boolean;
};

export type BottlePageHeaderProps = {
  actions?: ReactNode;
  bands?: TastingRatingDistributionProps | null;
  brand: string;
  brandHref?: string;
  detail?: ReactNode;
  id: string;
  imageUrl?: string | null;
  imageSourceUrl?: string | null;
  imageLicense?: string | null;
  memberStatus?: BottleMemberStatus;
  menu?: ReactNode;
  name: string;
  notes?: readonly string[];
  score?: ReviewScoreProps | null;
};

/** Presents a bottle's catalog identity, member actions, and community ratings. */
export function BottlePageHeader({
  actions,
  bands,
  brand,
  brandHref,
  detail,
  id,
  imageUrl,
  imageSourceUrl,
  imageLicense,
  memberStatus,
  menu,
  name,
  notes = [],
  score,
}: BottlePageHeaderProps) {
  const hasActions = Boolean(actions || menu);
  const hasRatings = Boolean(score || bands);
  const hasLongName = `${brand} ${name}`.length > 24;

  return (
    <header
      {...stylex.props(styles.root, hasRatings && styles.rootWithRatings)}
    >
      <div {...stylex.props(styles.stampPanel)}>
        <PeatedId detail={detail} id={id} />
      </div>
      <div
        {...stylex.props(
          styles.identityPanel,
          hasRatings && styles.identityPanelWithRatings,
        )}
      >
        <div {...stylex.props(styles.identityContent)}>
          <div {...stylex.props(styles.image)}>
            <BottleVisual
              imageUrl={imageUrl}
              label={`${brand} ${name}`}
              size="lg"
            />
          </div>
          <div {...stylex.props(styles.identity)}>
            <h1
              {...stylex.props(
                foundationStyles.pageTitle,
                styles.name,
                hasLongName && styles.longName,
              )}
            >
              {brandHref ? (
                <AppLink
                  href={brandHref}
                  title={brand}
                  {...stylex.props(styles.brand)}
                >
                  {brand}
                </AppLink>
              ) : (
                <span title={brand}>{brand}</span>
              )}{" "}
              {name}
            </h1>
            {notes.length ? (
              <div
                aria-label="Bottle details"
                role="group"
                {...stylex.props(styles.notes)}
              >
                {notes.map((note, index) => (
                  <Chip key={`${note}-${index}`} variant="tinted">
                    {note}
                  </Chip>
                ))}
              </div>
            ) : null}
            {hasActions ? (
              <div {...stylex.props(styles.actions)}>
                {actions}
                {menu}
              </div>
            ) : null}
            {memberStatus ? (
              <p {...stylex.props(styles.memberStatus)}>
                {memberStatus.isLibrary ? "In Library" : "Not in Library"}
                <span aria-hidden="true"> · </span>
                {memberStatus.hasTasted ? "Tasted" : "Not tasted"}
              </p>
            ) : null}
          </div>
          {imageUrl ? (
            <div {...stylex.props(styles.attribution)}>
              <ImageAttribution
                license={imageLicense}
                sourceUrl={imageSourceUrl}
              />
            </div>
          ) : null}
        </div>
      </div>
      {hasRatings ? (
        <div aria-label="Community ratings" {...stylex.props(styles.ratings)}>
          {score ? (
            <section {...stylex.props(styles.rating)}>
              <div {...stylex.props(styles.ratingContent)}>
                <ReviewScore {...score} />
              </div>
            </section>
          ) : null}
          {bands ? (
            <section {...stylex.props(styles.rating)}>
              <h2 {...stylex.props(styles.ratingLabel)}>Tasting ratings</h2>
              <div {...stylex.props(styles.ratingContent)}>
                <TastingRatingDistribution {...bands} />
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </header>
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
  },
  stampPanel: {
    boxSizing: "border-box",
    minWidth: 0,
    gridColumn: "1 / -1",
    paddingTop: { default: space.x6, [PHONE]: 0 },
    backgroundColor: "transparent",
  },
  identityPanel: {
    boxSizing: "border-box",
    minWidth: 0,
    gridColumn: "1",
    gridRow: "2",
    paddingTop: space.x4,
    paddingBottom: { default: space.x6, [PHONE]: 0 },
    backgroundColor: "transparent",
  },
  identityPanelWithRatings: {
    borderBottomRightRadius: 0,
  },
  identityContent: {
    display: "grid",
    gridTemplateColumns: {
      default: "132px minmax(0, 1fr)",
      [COMPACT]: "80px minmax(0, 1fr)",
    },
    minWidth: 0,
    alignItems: "start",
    columnGap: { default: space.x4, [COMPACT]: space.x2 },
  },
  identity: {
    minWidth: 0,
  },
  image: {
    minWidth: 0,
  },
  attribution: {
    gridColumn: { default: "1", [COMPACT]: "1 / -1" },
    marginTop: space.x1,
    minWidth: 0,
  },
  brand: {
    outline: "none",
    color: {
      default: "inherit",
      ":hover": colors.accentDeep,
    },
    textDecorationLine: {
      default: "none",
      ":hover": "underline",
    },
    textDecorationThickness: "1px",
    textUnderlineOffset: "3px",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  name: {
    overflowWrap: "anywhere",
    fontSize: {
      default: "clamp(30px, 4vw, 40px)",
      [COMPACT]: "28px",
      [PHONE]: "26px",
    },
    textWrap: "balance",
  },
  longName: {
    fontSize: {
      default: "clamp(28px, 3.5vw, 36px)",
      [COMPACT]: "26px",
      [PHONE]: "24px",
    },
  },
  notes: {
    display: "flex",
    gap: space.x2,
    marginTop: space.x3,
    flexWrap: "wrap",
  },
  actions: {
    position: { default: "static", [PHONE]: "fixed" },
    right: { default: "auto", [PHONE]: 0 },
    bottom: { default: "auto", [PHONE]: 0 },
    left: { default: "auto", [PHONE]: 0 },
    zIndex: { default: "auto", [PHONE]: 40 },
    boxSizing: "border-box",
    display: { default: "flex", [PHONE]: "grid" },
    width: { default: "auto", [PHONE]: "100%" },
    gridTemplateColumns: {
      default: "none",
      [PHONE]: "minmax(0, 1fr) auto auto",
    },
    gap: space.x2,
    marginTop: space.x4,
    alignItems: "center",
    flexWrap: "wrap",
    paddingTop: { default: 0, [PHONE]: "10px" },
    paddingRight: { default: 0, [PHONE]: space.x4 },
    paddingBottom: {
      default: 0,
      [PHONE]: "calc(10px + env(safe-area-inset-bottom))",
    },
    paddingLeft: { default: 0, [PHONE]: space.x4 },
    borderTopWidth: { default: 0, [PHONE]: "1px" },
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
    backgroundColor: { default: "transparent", [PHONE]: colors.surface },
  },
  memberStatus: {
    margin: 0,
    marginTop: space.x3,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "11px",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.45,
  },
  ratings: {
    boxSizing: "border-box",
    display: "grid",
    minWidth: 0,
    gridColumn: { default: "2", [NARROW]: "1" },
    gridRow: { default: "2", [NARROW]: "auto" },
    gridTemplateColumns: {
      default: "minmax(0, 1fr)",
      [NARROW]: "repeat(2, minmax(0, 1fr))",
      [PHONE]: "minmax(0, 1fr)",
    },
    gap: space.x4,
    marginTop: { default: 0, [NARROW]: "6px", [PHONE]: space.x4 },
    paddingTop: space.x4,
    paddingRight: 0,
    paddingBottom: { default: space.x6, [NARROW]: space.x4 },
    paddingLeft: { default: space.x6, [NARROW]: 0 },
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
    backgroundColor: "transparent",
  },
  rating: {
    display: { default: "block", [PHONE]: "grid" },
    minWidth: 0,
    gridTemplateColumns: {
      default: "none",
      [PHONE]: "minmax(78px, 1fr) minmax(0, 2fr)",
    },
    alignItems: "start",
    gap: { default: 0, [PHONE]: space.x3 },
  },
  ratingLabel: {
    margin: 0,
    marginBottom: { default: space.x2, [PHONE]: 0 },
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    fontWeight: 400,
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textTransform: "uppercase",
  },
  ratingContent: {
    minWidth: 0,
  },
});
