import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { foundationStyles } from "../../../styles/foundations.stylex";
import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../../../styles/tokens.stylex";
import type {
  CommunityScoreProps,
  SpecStripCells,
  VerdictDistributionProps,
} from "../components";
import {
  BottleVisual,
  Chip,
  CommunityScore,
  RecordId,
  SpecStrip,
  VerdictDistribution,
} from "../components";

const NARROW = "@media (max-width: 900px)";
const COMPACT = "@media (max-width: 639px)";
const PHONE = "@media (max-width: 480px)";

export type BottleMemberStatus = {
  hasTasted: boolean;
  isLibrary: boolean;
};

export type BottlePageHeaderProps = {
  actions?: ReactNode;
  brand: string;
  brandHref?: string;
  detail?: string;
  id: string;
  imageUrl?: string | null;
  memberStatus?: BottleMemberStatus;
  menu?: ReactNode;
  name: string;
  notes?: readonly string[];
  score?: CommunityScoreProps | null;
  specs: SpecStripCells;
  verdict?: VerdictDistributionProps | null;
};

/** Presents a bottle's catalog identity, member actions, community measures, and core facts. */
export function BottlePageHeader({
  actions,
  brand,
  brandHref,
  detail,
  id,
  imageUrl,
  memberStatus,
  menu,
  name,
  notes = [],
  score,
  specs,
  verdict,
}: BottlePageHeaderProps) {
  const Brand = brandHref ? "a" : "span";
  const hasActions = Boolean(actions || menu);
  const hasMeasures = Boolean(score || verdict);

  return (
    <header
      {...stylex.props(styles.root, hasMeasures && styles.rootWithMeasures)}
    >
      <div {...stylex.props(styles.stampPanel)}>
        <RecordId detail={detail} id={id} />
      </div>
      <div
        {...stylex.props(
          styles.identityPanel,
          hasMeasures && styles.identityPanelWithMeasures,
        )}
      >
        <div {...stylex.props(styles.identityContent)}>
          <BottleVisual
            imageUrl={imageUrl}
            label={`${brand} ${name}`}
            size="lg"
          />
          <div {...stylex.props(styles.identity)}>
            <Brand href={brandHref} {...stylex.props(styles.brand)}>
              {brand}
            </Brand>
            <h1 {...stylex.props(foundationStyles.pageTitle, styles.name)}>
              {name}
            </h1>
            {notes.length ? (
              <div aria-label="Bottle details" {...stylex.props(styles.notes)}>
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
                {memberStatus.isLibrary ? "In library" : "Not in library"}
                <span aria-hidden="true"> · </span>
                {memberStatus.hasTasted ? "Tasted" : "Not tasted"}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <div {...stylex.props(styles.specs)}>
        <SpecStrip cells={specs} />
      </div>
      {hasMeasures ? (
        <div aria-label="Community measures" {...stylex.props(styles.measures)}>
          {score ? (
            <section {...stylex.props(styles.measure)}>
              <h2 {...stylex.props(styles.measureLabel)}>Community score</h2>
              <div {...stylex.props(styles.measureContent)}>
                <CommunityScore {...score} />
              </div>
            </section>
          ) : null}
          {verdict ? (
            <section {...stylex.props(styles.measure)}>
              <h2 {...stylex.props(styles.measureLabel)}>Community verdict</h2>
              <div {...stylex.props(styles.measureContent)}>
                <VerdictDistribution {...verdict} />
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
  rootWithMeasures: {
    gridTemplateColumns: {
      default: "minmax(0, 1fr) 260px",
      [NARROW]: "minmax(0, 1fr)",
    },
  },
  stampPanel: {
    boxSizing: "border-box",
    minWidth: 0,
    gridColumn: "1 / -1",
    paddingTop: { default: space.x6, [COMPACT]: space.x4, [PHONE]: 0 },
    paddingRight: { default: space.x6, [COMPACT]: space.x4, [PHONE]: 0 },
    paddingLeft: { default: space.x6, [COMPACT]: space.x4, [PHONE]: 0 },
    borderTopLeftRadius: controlMetrics.radius,
    borderTopRightRadius: controlMetrics.radius,
    backgroundColor: { default: colors.surface, [PHONE]: "transparent" },
  },
  identityPanel: {
    boxSizing: "border-box",
    minWidth: 0,
    gridColumn: "1",
    gridRow: "2",
    paddingTop: space.x4,
    paddingRight: { default: space.x6, [COMPACT]: space.x4, [PHONE]: 0 },
    paddingBottom: { default: space.x6, [COMPACT]: space.x4, [PHONE]: 0 },
    paddingLeft: { default: space.x6, [COMPACT]: space.x4, [PHONE]: 0 },
    borderBottomLeftRadius: controlMetrics.radius,
    borderBottomRightRadius: controlMetrics.radius,
    backgroundColor: { default: colors.surface, [PHONE]: "transparent" },
  },
  identityPanelWithMeasures: {
    borderBottomRightRadius: {
      default: 0,
      [NARROW]: controlMetrics.radius,
    },
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
  brand: {
    display: "inline-block",
    maxWidth: "100%",
    overflow: "hidden",
    outline: "none",
    color: colors.accentDeep,
    fontFamily: fonts.data,
    fontSize: "11px",
    fontWeight: 500,
    letterSpacing: "0.08em",
    lineHeight: 1.3,
    textDecoration: "none",
    textOverflow: "ellipsis",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    boxShadow: {
      default: "none",
      ":focus-visible": effects.focusRing,
    },
  },
  name: {
    marginTop: space.x1,
    overflowWrap: "anywhere",
    fontSize: {
      default: "clamp(32px, 5vw, 44px)",
      [COMPACT]: "28px",
      [PHONE]: "26px",
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
  measures: {
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
    paddingRight: { default: space.x6, [PHONE]: 0 },
    paddingBottom: { default: space.x6, [NARROW]: space.x4 },
    paddingLeft: { default: space.x6, [PHONE]: 0 },
    borderBottomRightRadius: controlMetrics.radius,
    borderBottomLeftRadius: { default: 0, [NARROW]: controlMetrics.radius },
    borderTopLeftRadius: { default: 0, [NARROW]: controlMetrics.radius },
    borderTopRightRadius: { default: 0, [NARROW]: controlMetrics.radius },
    borderTopWidth: { default: 0, [PHONE]: "1px" },
    borderTopStyle: "solid",
    borderTopColor: colors.hairline,
    backgroundColor: { default: colors.surface, [PHONE]: "transparent" },
  },
  measure: {
    display: { default: "block", [PHONE]: "grid" },
    minWidth: 0,
    gridTemplateColumns: {
      default: "none",
      [PHONE]: "minmax(78px, 1fr) minmax(0, 2fr)",
    },
    alignItems: "start",
    gap: { default: 0, [PHONE]: space.x3 },
  },
  measureLabel: {
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
  measureContent: {
    minWidth: 0,
  },
  specs: {
    minWidth: 0,
    gridColumn: "1 / -1",
    gridRow: "3",
    marginTop: space.x3,
  },
});
